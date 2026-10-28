-- CreateEnum
CREATE TYPE "CreditKind" AS ENUM ('WELCOME', 'PURCHASE', 'ATHLETE', 'ADJUSTMENT');

-- AlterEnum
ALTER TYPE "InvoiceKind" ADD VALUE 'CREDITS';

-- DropForeignKey
ALTER TABLE "Payout" DROP CONSTRAINT "Payout_eventId_fkey";

-- DropForeignKey
ALTER TABLE "Payout" DROP CONSTRAINT "Payout_federationId_fkey";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "platformFeeCents";

-- AlterTable
ALTER TABLE "Federation" DROP COLUMN "payoutHolder",
DROP COLUMN "payoutIban";

-- AlterTable
ALTER TABLE "MembershipPayment" ADD COLUMN     "accountId" TEXT;

-- AlterTable
ALTER TABLE "Organizer" DROP COLUMN "payoutHolder",
DROP COLUMN "payoutIban",
ADD COLUMN     "credits" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "accountId" TEXT;

-- DropTable
DROP TABLE "Payout";

-- CreateTable
CREATE TABLE "PaymentAccount" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT,
    "federationId" TEXT,
    "proxypayToken" TEXT,
    "proxypayPosId" INTEGER,
    "proxypaySandbox" BOOLEAN NOT NULL DEFAULT false,
    "paypalClientId" TEXT,
    "paypalSecret" TEXT,
    "paypalSandbox" BOOLEAN NOT NULL DEFAULT false,
    "paypalCurrency" CHAR(3) NOT NULL DEFAULT 'USD',
    "paypalExchangeRate" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPurchase" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "unitCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidById" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerRef" TEXT,
    "chargeCurrency" CHAR(3) NOT NULL,
    "chargeAmountCents" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "CreditPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "kind" "CreditKind" NOT NULL,
    "delta" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "eventId" TEXT,
    "athleteId" TEXT,
    "purchaseId" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAccount_organizerId_key" ON "PaymentAccount"("organizerId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAccount_federationId_key" ON "PaymentAccount"("federationId");

-- CreateIndex
CREATE INDEX "CreditPurchase_organizerId_status_idx" ON "CreditPurchase"("organizerId", "status");

-- CreateIndex
CREATE INDEX "CreditPurchase_status_createdAt_idx" ON "CreditPurchase"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPurchase_provider_providerRef_key" ON "CreditPurchase"("provider", "providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_purchaseId_key" ON "CreditTransaction"("purchaseId");

-- CreateIndex
CREATE INDEX "CreditTransaction_organizerId_createdAt_idx" ON "CreditTransaction"("organizerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_eventId_athleteId_key" ON "CreditTransaction"("eventId", "athleteId");

-- AddForeignKey
ALTER TABLE "PaymentAccount" ADD CONSTRAINT "PaymentAccount_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAccount" ADD CONSTRAINT "PaymentAccount_federationId_fkey" FOREIGN KEY ("federationId") REFERENCES "Federation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPurchase" ADD CONSTRAINT "CreditPurchase_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaymentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPayment" ADD CONSTRAINT "MembershipPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaymentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Organizações que já existiam: os mesmos 20 créditos de boas-vindas das novas.
UPDATE "Organizer" SET "credits" = 20;
INSERT INTO "CreditTransaction" ("id", "organizerId", "kind", "delta", "balance", "note")
SELECT gen_random_uuid()::text, o."id", 'WELCOME', 20, 20, 'Créditos de boas-vindas'
  FROM "Organizer" o;

-- Atletas já confirmados antes dos créditos: a taxa deles era cobrada no modelo antigo. Ficam
-- contados (sem gastar créditos) para os eventos que já decorrem não ficarem bloqueados.
INSERT INTO "CreditTransaction" ("id", "organizerId", "kind", "delta", "balance", "eventId", "athleteId", "note")
SELECT gen_random_uuid()::text, e."organizerId", 'ATHLETE', 0, 20, r."eventId", r."athleteId", 'Confirmado antes dos créditos'
  FROM (SELECT DISTINCT "eventId", "athleteId" FROM "Registration" WHERE "confirmedAt" IS NOT NULL) r
  JOIN "Event" e ON e."id" = r."eventId";
