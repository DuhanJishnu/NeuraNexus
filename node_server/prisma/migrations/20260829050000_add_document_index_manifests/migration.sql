CREATE TABLE "DocumentIndexManifest" (
  "id" SERIAL NOT NULL,
  "documentId" INTEGER NOT NULL,
  "indexVersion" TEXT NOT NULL,
  "vectorIdPrefix" TEXT NOT NULL,
  "chunkCount" INTEGER NOT NULL,
  "embeddingModel" TEXT NOT NULL,
  "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentIndexManifest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentIndexManifest_documentId_indexVersion_key"
ON "DocumentIndexManifest"("documentId", "indexVersion");

CREATE INDEX "DocumentIndexManifest_indexVersion_documentId_idx"
ON "DocumentIndexManifest"("indexVersion", "documentId");

ALTER TABLE "DocumentIndexManifest"
ADD CONSTRAINT "DocumentIndexManifest_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "Document"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "DocumentIndexManifest" (
  "documentId", "indexVersion", "vectorIdPrefix", "chunkCount",
  "embeddingModel", "indexedAt"
)
SELECT
  id, "indexVersion", "vectorIdPrefix", "chunkCount",
  "embeddingModel", COALESCE("indexedAt", CURRENT_TIMESTAMP)
FROM "Document"
WHERE "indexVersion" IS NOT NULL
  AND "vectorIdPrefix" IS NOT NULL
  AND "chunkCount" IS NOT NULL
  AND "embeddingModel" IS NOT NULL;
