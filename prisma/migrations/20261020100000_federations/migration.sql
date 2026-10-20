-- CreateEnum
CREATE TYPE "FederationPlan" AS ENUM ('BASIC', 'PREMIUM');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "Payout" DROP CONSTRAINT "Payout_eventId_fkey";

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "federationId" TEXT,
ADD COLUMN     "requiresMembership" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "federationId" TEXT,
ALTER COLUMN "eventId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Federation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#d21f2b',
    "plan" "FederationPlan",
    "planExpiresAt" TIMESTAMP(3),
    "payoutHolder" TEXT,
    "payoutIban" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Federation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FederationMember" (
    "federationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FederationMember_pkey" PRIMARY KEY ("federationId","userId")
);

-- CreateTable
CREATE TABLE "FederationOrganizer" (
    "federationId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FederationOrganizer_pkey" PRIMARY KEY ("federationId","organizerId")
);

-- CreateTable
CREATE TABLE "FederationAcademy" (
    "federationId" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FederationAcademy_pkey" PRIMARY KEY ("federationId","academyId")
);

-- CreateTable
CREATE TABLE "MembershipPlan" (
    "id" TEXT NOT NULL,
    "federationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "months" INTEGER NOT NULL DEFAULT 12,
    "maxAge" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "federationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "boughtById" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "priceCents" INTEGER NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipPayment" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerRef" TEXT,
    "amountCents" INTEGER NOT NULL,
    "chargeCurrency" CHAR(3) NOT NULL,
    "chargeAmountCents" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "MembershipPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FederationPost" (
    "id" TEXT NOT NULL,
    "federationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FederationPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Federation_slug_key" ON "Federation"("slug");

-- CreateIndex
CREATE INDEX "FederationMember_userId_idx" ON "FederationMember"("userId");

-- CreateIndex
CREATE INDEX "FederationOrganizer_organizerId_idx" ON "FederationOrganizer"("organizerId");

-- CreateIndex
CREATE INDEX "FederationAcademy_academyId_idx" ON "FederationAcademy"("academyId");

-- CreateIndex
CREATE INDEX "MembershipPlan_federationId_idx" ON "MembershipPlan"("federationId");

-- CreateIndex
CREATE INDEX "Membership_federationId_status_idx" ON "Membership"("federationId", "status");

-- CreateIndex
CREATE INDEX "Membership_athleteId_federationId_idx" ON "Membership"("athleteId", "federationId");

-- CreateIndex
CREATE INDEX "MembershipPayment_membershipId_idx" ON "MembershipPayment"("membershipId");

-- CreateIndex
CREATE INDEX "MembershipPayment_status_createdAt_idx" ON "MembershipPayment"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPayment_provider_providerRef_key" ON "MembershipPayment"("provider", "providerRef");

-- CreateIndex
CREATE INDEX "FederationPost_federationId_publishedAt_idx" ON "FederationPost"("federationId", "publishedAt");

-- CreateIndex
CREATE INDEX "Event_federationId_startsAt_idx" ON "Event"("federationId", "startsAt");

-- CreateIndex
CREATE INDEX "Payout_federationId_idx" ON "Payout"("federationId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_federationId_fkey" FOREIGN KEY ("federationId") REFERENCES "Federation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_federationId_fkey" FOREIGN KEY ("federationId") REFERENCES "Federation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederationMember" ADD CONSTRAINT "FederationMember_federationId_fkey" FOREIGN KEY ("federationId") REFERENCES "Federation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederationMember" ADD CONSTRAINT "FederationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederationOrganizer" ADD CONSTRAINT "FederationOrganizer_federationId_fkey" FOREIGN KEY ("federationId") REFERENCES "Federation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederationOrganizer" ADD CONSTRAINT "FederationOrganizer_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederationAcademy" ADD CONSTRAINT "FederationAcademy_federationId_fkey" FOREIGN KEY ("federationId") REFERENCES "Federation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederationAcademy" ADD CONSTRAINT "FederationAcademy_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "Academy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_federationId_fkey" FOREIGN KEY ("federationId") REFERENCES "Federation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_federationId_fkey" FOREIGN KEY ("federationId") REFERENCES "Federation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPayment" ADD CONSTRAINT "MembershipPayment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederationPost" ADD CONSTRAINT "FederationPost_federationId_fkey" FOREIGN KEY ("federationId") REFERENCES "Federation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

