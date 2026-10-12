/*
  Warnings:

  - Added the required column `chargeAmountCents` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `chargeCurrency` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `provider` on the `Payment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MULTICAIXA_EXPRESS', 'PAYPAL', 'SIMULATOR');

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "currency" SET DEFAULT 'AOA';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "chargeAmountCents" INTEGER NOT NULL,
ADD COLUMN     "chargeCurrency" CHAR(3) NOT NULL,
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "settledAt" TIMESTAMP(3),
DROP COLUMN "provider",
ADD COLUMN     "provider" "PaymentProvider" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerRef_key" ON "Payment"("provider", "providerRef");
