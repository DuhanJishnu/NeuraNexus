/*
  Warnings:

  - Changed the type of `systemResponse` on the `Exchange` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "public"."Document" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT '2025-10-02 20:00:00 +05:30';

-- AlterTable
ALTER TABLE "public"."Exchange" DROP COLUMN "systemResponse",
ADD COLUMN     "systemResponse" JSONB NOT NULL;
