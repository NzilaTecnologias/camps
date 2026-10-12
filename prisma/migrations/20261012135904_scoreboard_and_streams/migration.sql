-- AlterTable
ALTER TABLE "Mat" ADD COLUMN     "currentMatchId" TEXT,
ADD COLUMN     "isLive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "streamUrl" TEXT;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "blueAdvantages" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bluePenalties" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "clockRemainingMs" INTEGER,
ADD COLUMN     "clockStartedAt" TIMESTAMP(3),
ADD COLUMN     "durationSeconds" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "redAdvantages" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "redPenalties" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Mat_currentMatchId_key" ON "Mat"("currentMatchId");

-- AddForeignKey
ALTER TABLE "Mat" ADD CONSTRAINT "Mat_currentMatchId_fkey" FOREIGN KEY ("currentMatchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

