-- AlterEnum
ALTER TYPE "BracketType" ADD VALUE 'DOUBLE_ELIMINATION';

-- AlterTable
ALTER TABLE "Division" ADD COLUMN     "matId" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "matchMinutes" INTEGER NOT NULL DEFAULT 8;

-- AlterTable
ALTER TABLE "Mat" ADD COLUMN     "startsAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Division_matId_idx" ON "Division"("matId");

-- AddForeignKey
ALTER TABLE "Division" ADD CONSTRAINT "Division_matId_fkey" FOREIGN KEY ("matId") REFERENCES "Mat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
