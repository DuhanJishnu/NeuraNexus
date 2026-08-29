ALTER TABLE "Document"
ADD COLUMN "vectorIdPrefix" TEXT,
ADD COLUMN "chunkCount" INTEGER,
ADD COLUMN "embeddingModel" TEXT,
ADD COLUMN "indexVersion" TEXT,
ADD COLUMN "indexedAt" TIMESTAMP(3);
