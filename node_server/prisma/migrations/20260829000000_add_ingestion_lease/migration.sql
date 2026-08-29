ALTER TABLE "Document"
ADD COLUMN "processingStartedAt" TIMESTAMP(3),
ADD COLUMN "processedAt" TIMESTAMP(3);

CREATE INDEX "Document_status_retriesCount_uploadDateTime_idx"
ON "Document"("status", "retriesCount", "uploadDateTime");
