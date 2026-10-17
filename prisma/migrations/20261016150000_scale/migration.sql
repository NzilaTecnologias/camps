-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- AlterTable
ALTER TABLE "Academy" ADD COLUMN     "athleteCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bronze" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gold" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rank" INTEGER,
ADD COLUMN     "silver" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "paidRegistrations" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Academy_rank_idx" ON "Academy"("rank");

-- CreateIndex
CREATE INDEX "Academy_name_trgm_idx" ON "Academy" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "AthleteProfile_firstName_trgm_idx" ON "AthleteProfile" USING GIN ("firstName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "AthleteProfile_lastName_trgm_idx" ON "AthleteProfile" USING GIN ("lastName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Event_status_paidRegistrations_idx" ON "Event"("status", "paidRegistrations");

-- CreateIndex
CREATE INDEX "Event_name_trgm_idx" ON "Event" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Event_city_trgm_idx" ON "Event" USING GIN ("city" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Match_redId_idx" ON "Match"("redId");

-- CreateIndex
CREATE INDEX "Match_blueId_idx" ON "Match"("blueId");

-- CreateIndex
CREATE INDEX "Match_winnerId_idx" ON "Match"("winnerId");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX "Registration_athleteId_idx" ON "Registration"("athleteId");

-- CreateIndex
CREATE INDEX "Registration_couponId_idx" ON "Registration"("couponId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

