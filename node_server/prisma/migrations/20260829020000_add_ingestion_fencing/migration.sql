ALTER TABLE "Document"
ADD COLUMN "processingLeaseId" TEXT,
ADD COLUMN "targetIndexVersion" TEXT;

CREATE INDEX "Document_processingLeaseId_idx"
ON "Document"("processingLeaseId");
