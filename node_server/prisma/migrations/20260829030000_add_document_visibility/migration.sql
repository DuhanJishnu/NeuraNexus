CREATE TYPE "DocumentVisibility" AS ENUM ('GLOBAL', 'PRIVATE');

ALTER TABLE "Document"
ADD COLUMN "visibility" "DocumentVisibility" NOT NULL DEFAULT 'GLOBAL',
ADD COLUMN "ownerId" TEXT;

ALTER TABLE "Document"
ADD CONSTRAINT "Document_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Document_visibility_ownerId_status_idx"
ON "Document"("visibility", "ownerId", "status");
