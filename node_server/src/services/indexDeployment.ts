import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import {
  INGESTION_SERVICE_TOKEN,
  PYTHON_SERVER_URL,
  RAG_ACTIVE_INDEX_VERSION,
  RAG_PROMOTION_MAX_ERROR_RATE,
  RAG_PROMOTION_MAX_HIT_RATE_REGRESSION,
  RAG_PROMOTION_MAX_MRR_REGRESSION,
  RAG_PROMOTION_MAX_P95_MS,
  RAG_PROMOTION_MAX_P95_MULTIPLIER,
  RAG_PROMOTION_MIN_HIT_RATE,
  RAG_PROMOTION_MIN_MRR,
  RAG_PROMOTION_MIN_QUERIES,
} from '../config/envExports';


const ACTIVE_INDEX_CACHE_KEY = 'rag:active-index-version';

export type EvaluationMetrics = {
  hitRate: number;
  mrr: number;
  errorRate: number;
  p95LatencyMs: number;
  queryCount: number;
  baselineHitRate: number;
  baselineMrr: number;
  baselineErrorRate: number;
  baselineP95LatencyMs: number;
  baselineQueryCount: number;
};

export class IndexDeploymentService {
  private static async ensureFallbackActiveDeployment(): Promise<void> {
    const active = await prisma.ragIndexDeployment.findFirst({
      where: { state: 'ACTIVE' },
      select: { version: true },
    });
    if (!active) {
      await prisma.ragIndexDeployment.upsert({
        where: { version: RAG_ACTIVE_INDEX_VERSION },
        create: {
          version: RAG_ACTIVE_INDEX_VERSION,
          state: 'ACTIVE',
          promotedAt: new Date(),
        },
        update: { state: 'ACTIVE' },
      });
    }
  }

  static async getActiveVersion(): Promise<string> {
    const cached = await redis.get(ACTIVE_INDEX_CACHE_KEY);
    if (cached) return cached;
    const active = await prisma.ragIndexDeployment.findFirst({
      where: { state: 'ACTIVE' },
      select: { version: true },
    });
    const version = active?.version || RAG_ACTIVE_INDEX_VERSION;
    await redis.set(ACTIVE_INDEX_CACHE_KEY, version, 'EX', 60);
    return version;
  }

  static async list() {
    return prisma.ragIndexDeployment.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  static async registerCandidate(version: string) {
    await this.ensureFallbackActiveDeployment();
    const response = await fetch(`${PYTHON_SERVER_URL}/api/indexes`, {
      headers: { Authorization: `Bearer ${INGESTION_SERVICE_TOKEN}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('Unable to verify configured Python indexes');
    const body = await response.json() as { indexes?: Array<{ version: string }> };
    if (!body.indexes?.some(index => index.version === version)) {
      throw new Error(`Index version is not configured in Python: ${version}`);
    }
    const existing = await prisma.ragIndexDeployment.findUnique({ where: { version } });
    if (existing?.state === 'ACTIVE') return existing;
    return prisma.ragIndexDeployment.upsert({
      where: { version },
      create: { version, state: 'CANDIDATE' },
      update: {
        state: 'CANDIDATE',
        evaluationMetrics: Prisma.DbNull,
        evaluatedAt: null,
      },
    });
  }

  static async recordEvaluation(version: string, metrics: EvaluationMetrics) {
    const candidate = await prisma.ragIndexDeployment.findUnique({ where: { version } });
    if (!candidate || candidate.state !== 'CANDIDATE') {
      throw new Error('Candidate index not found');
    }
    return prisma.ragIndexDeployment.update({
      where: { version },
      data: {
        evaluationMetrics: metrics,
        evaluatedAt: new Date(),
      },
    });
  }

  static assertPromotionQuality(metrics: EvaluationMetrics | null): void {
    if (!metrics) throw new Error('Candidate has no evaluation metrics');
    const values = Object.values(metrics);
    if (values.length !== 10 || values.some(value => !Number.isFinite(value))) {
      throw new Error('Candidate evaluation metrics are incomplete or invalid');
    }
    const failures = [];
    if (metrics.hitRate < RAG_PROMOTION_MIN_HIT_RATE) failures.push('hit rate');
    if (metrics.mrr < RAG_PROMOTION_MIN_MRR) failures.push('MRR');
    if (metrics.errorRate > RAG_PROMOTION_MAX_ERROR_RATE) failures.push('error rate');
    if (metrics.p95LatencyMs > RAG_PROMOTION_MAX_P95_MS) failures.push('p95 latency');
    if (metrics.queryCount < RAG_PROMOTION_MIN_QUERIES) failures.push('query count');
    if (metrics.queryCount !== metrics.baselineQueryCount) failures.push('baseline query count');
    if (
      metrics.hitRate < metrics.baselineHitRate - RAG_PROMOTION_MAX_HIT_RATE_REGRESSION
    ) failures.push('hit-rate regression');
    if (metrics.mrr < metrics.baselineMrr - RAG_PROMOTION_MAX_MRR_REGRESSION) {
      failures.push('MRR regression');
    }
    const baselineLatencyLimit = Math.max(
      metrics.baselineP95LatencyMs * RAG_PROMOTION_MAX_P95_MULTIPLIER,
      metrics.baselineP95LatencyMs + 50,
    );
    if (metrics.p95LatencyMs > baselineLatencyLimit) failures.push('p95 latency regression');
    if (failures.length) {
      throw new Error(`Candidate failed promotion gates: ${failures.join(', ')}`);
    }
  }

  static async promote(version: string) {
    const promoted = await prisma.$transaction(async transaction => {
      const candidate = await transaction.ragIndexDeployment.findUnique({
        where: { version },
      });
      if (!candidate || candidate.state !== 'CANDIDATE') {
        throw new Error('Candidate index not found');
      }
      this.assertPromotionQuality(
        candidate.evaluationMetrics as EvaluationMetrics | null,
      );
      const latestManifest = await transaction.documentIndexManifest.aggregate({
        where: { indexVersion: version },
        _max: { indexedAt: true },
      });
      if (
        !candidate.evaluatedAt
        || (
          latestManifest._max.indexedAt
          && candidate.evaluatedAt < latestManifest._max.indexedAt
        )
      ) {
        throw new Error('Candidate evaluation is older than its latest indexing change');
      }
      const incompleteDocuments = await transaction.document.count({
        where: {
          isCompressed: true,
          indexManifests: { none: { indexVersion: version } },
        },
      });
      if (incompleteDocuments > 0) {
        throw new Error(
          `${incompleteDocuments} documents have not completed candidate indexing`,
        );
      }
      await transaction.ragIndexDeployment.updateMany({
        where: { state: 'ACTIVE' },
        data: { state: 'RETIRED' },
      });
      return transaction.ragIndexDeployment.update({
        where: { version, state: 'CANDIDATE' },
        data: { state: 'ACTIVE', promotedAt: new Date() },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await redis.set(ACTIVE_INDEX_CACHE_KEY, version, 'EX', 60);
    return promoted;
  }

  static async rollback(version: string) {
    const deployment = await prisma.ragIndexDeployment.findUnique({ where: { version } });
    if (!deployment || deployment.state !== 'RETIRED') {
      throw new Error('Retired rollback target not found');
    }
    const result = await prisma.$transaction(async transaction => {
      const active = await transaction.ragIndexDeployment.findFirst({
        where: { state: 'ACTIVE' },
        select: { version: true },
      });
      const uncoveredDocuments = await transaction.document.count({
        where: {
          isCompressed: true,
          indexManifests: { none: { indexVersion: version } },
        },
      });
      if (uncoveredDocuments > 0) {
        throw new Error(
          `${uncoveredDocuments} documents are missing from the rollback index`,
        );
      }
      await transaction.ragIndexDeployment.updateMany({
        where: { state: 'ACTIVE' },
        data: { state: 'RETIRED' },
      });
      const rolledBack = await transaction.ragIndexDeployment.update({
        where: { version, state: 'RETIRED' },
        data: { state: 'ACTIVE', promotedAt: new Date() },
      });
      return { rolledBack, replacedVersion: active?.version || null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await redis.set(ACTIVE_INDEX_CACHE_KEY, version, 'EX', 60);
    return result;
  }
}
