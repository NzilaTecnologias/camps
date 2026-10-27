-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Event_status_publishedAt_idx" ON "Event"("status", "publishedAt");

-- Eventos já publicados: sem saber quando foram publicados, fica a data de criação.
UPDATE "Event" SET "publishedAt" = "createdAt" WHERE "status" = 'PUBLISHED' AND "publishedAt" IS NULL;
