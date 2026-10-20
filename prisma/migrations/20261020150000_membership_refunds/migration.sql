-- CreateTable
CREATE TABLE "MembershipRefund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "providerRef" TEXT,
    "reason" TEXT NOT NULL,
    "failureReason" TEXT,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "MembershipRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipRefund_paymentId_key" ON "MembershipRefund"("paymentId");

-- CreateIndex
CREATE INDEX "MembershipRefund_status_idx" ON "MembershipRefund"("status");

-- AddForeignKey
ALTER TABLE "MembershipRefund" ADD CONSTRAINT "MembershipRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "MembershipPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRefund" ADD CONSTRAINT "MembershipRefund_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

