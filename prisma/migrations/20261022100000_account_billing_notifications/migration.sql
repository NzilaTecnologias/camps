-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('PLATFORM_FEE', 'FEDERATION_PLAN');

-- AlterEnum
ALTER TYPE "AuthTokenKind" ADD VALUE 'EMAIL_CHANGE';

-- AlterTable
ALTER TABLE "AuthToken" ADD COLUMN     "newEmail" TEXT;

-- AlterTable
ALTER TABLE "Federation" ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "billingName" TEXT,
ADD COLUMN     "billingNif" TEXT;

-- AlterTable
ALTER TABLE "Organizer" ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "billingName" TEXT,
ADD COLUMN     "billingNif" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FederationPlanPayment" (
    "id" TEXT NOT NULL,
    "federationId" TEXT NOT NULL,
    "plan" "FederationPlan" NOT NULL,
    "months" INTEGER NOT NULL DEFAULT 12,
    "paidById" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerRef" TEXT,
    "amountCents" INTEGER NOT NULL,
    "chargeCurrency" CHAR(3) NOT NULL,
    "chargeAmountCents" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "FederationPlanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "kind" "InvoiceKind" NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerName" TEXT NOT NULL,
    "customerNif" TEXT,
    "customerAddress" TEXT,
    "customerEmail" TEXT NOT NULL,
    "organizerId" TEXT,
    "eventId" TEXT,
    "federationId" TEXT,
    "lines" JSONB NOT NULL,
    "netCents" INTEGER NOT NULL,
    "vatRateBp" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'AOA',
    "provider" TEXT NOT NULL DEFAULT 'internal',
    "certified" BOOLEAN NOT NULL DEFAULT false,
    "externalNumber" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSeries" (
    "series" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceSeries_pkey" PRIMARY KEY ("series")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FederationPlanPayment_federationId_status_idx" ON "FederationPlanPayment"("federationId", "status");

-- CreateIndex
CREATE INDEX "FederationPlanPayment_status_createdAt_idx" ON "FederationPlanPayment"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FederationPlanPayment_provider_providerRef_key" ON "FederationPlanPayment"("provider", "providerRef");

-- CreateIndex
CREATE INDEX "Invoice_eventId_kind_idx" ON "Invoice"("eventId", "kind");

-- CreateIndex
CREATE INDEX "Invoice_federationId_idx" ON "Invoice"("federationId");

-- CreateIndex
CREATE INDEX "Invoice_organizerId_idx" ON "Invoice"("organizerId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_series_number_key" ON "Invoice"("series", "number");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_kind_key_key" ON "NotificationLog"("kind", "key");

-- AddForeignKey
ALTER TABLE "FederationPlanPayment" ADD CONSTRAINT "FederationPlanPayment_federationId_fkey" FOREIGN KEY ("federationId") REFERENCES "Federation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

