CREATE TYPE "RagIndexState" AS ENUM ('ACTIVE', 'CANDIDATE', 'RETIRED');

CREATE TABLE "RagIndexDeployment" (
  "version" TEXT NOT NULL,
  "state" "RagIndexState" NOT NULL DEFAULT 'CANDIDATE',
  "evaluationMetrics" JSONB,
  "evaluatedAt" TIMESTAMP(3),
  "promotedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RagIndexDeployment_pkey" PRIMARY KEY ("version")
);

CREATE INDEX "RagIndexDeployment_state_updatedAt_idx"
ON "RagIndexDeployment"("state", "updatedAt");

CREATE UNIQUE INDEX "RagIndexDeployment_single_active_idx"
ON "RagIndexDeployment"("state") WHERE "state" = 'ACTIVE';
