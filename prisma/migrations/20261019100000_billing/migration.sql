-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "platformFeeCents" INTEGER NOT NULL DEFAULT 50000;

-- AlterTable
ALTER TABLE "Organizer" ADD COLUMN     "payoutHolder" TEXT,
ADD COLUMN     "payoutIban" TEXT;

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "confirmedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payout_eventId_idx" ON "Payout"("eventId");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Inscrições já confirmadas antes desta migração contam a partir da data em que foram feitas.
UPDATE "Registration" SET "confirmedAt" = "createdAt" WHERE status = 'PAID' AND "confirmedAt" IS NULL;
