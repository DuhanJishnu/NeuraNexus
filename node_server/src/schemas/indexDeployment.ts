import { z } from 'zod';


export const indexVersionSchema = z.object({
  version: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/),
});

export const indexEvaluationSchema = indexVersionSchema.extend({
  metrics: z.object({
    hitRate: z.number().min(0).max(1),
    mrr: z.number().min(0).max(1),
    errorRate: z.number().min(0).max(1),
    p95LatencyMs: z.number().nonnegative(),
    queryCount: z.number().int().positive(),
    baselineHitRate: z.number().min(0).max(1),
    baselineMrr: z.number().min(0).max(1),
    baselineErrorRate: z.number().min(0).max(1),
    baselineP95LatencyMs: z.number().nonnegative(),
    baselineQueryCount: z.number().int().positive(),
  }),
});
