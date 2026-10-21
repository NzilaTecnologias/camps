import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { appUrl, providerFor } from "./payments";
import type { Outcome } from "./payments/types";
import { deliverEmail } from "./email";
import { registrationRefundedEmail } from "./notifications";
import { memberOf } from "./manage";

// Reembolsos são sempre totais (a OPG da ProxyPay não faz parciais) e só o organizador os pede.
// Quando a devolução se confirma, o pagamento passa a REFUNDED e a inscrição é cancelada.

/** Grava o desfecho de uma devolução uma única vez. */
async function settleRefund(refundId: string, outcome: Outcome) {
  if (outcome.status === "PENDING") return;
  const emailId = await prisma.$transaction(async (tx) => {
    const { count } = await tx.refund.updateMany({
      where: { id: refundId, status: "PENDING" },
      data: {
        status: outcome.status,
        failureReason: outcome.status === "FAILED" ? outcome.reason : null,
        settledAt: new Date(),
      },
    });
    if (count === 0 || outcome.status !== "SUCCEEDED") return null;
    const refund = await tx.refund.findUniqueOrThrow({ where: { id: refundId }, include: { payment: true } });
    await tx.payment.update({ where: { id: refund.paymentId }, data: { status: "REFUNDED" } });
    await tx.registration.update({ where: { id: refund.payment.registrationId }, data: { status: "CANCELLED" } });
    return registrationRefundedEmail(tx, refund.payment.registrationId, refund.payment.amountCents, refund.manual);
  });
  if (emailId) await deliverEmail(emailId);
}

/**
 * Devolve um pagamento concluído. `manual` regista uma devolução feita fora da plataforma
 * (numerário, transferência); sem ele, a devolução é pedida ao provedor que cobrou.
 */
export async function requestRefund(
  userId: string,
  paymentId: string,
  input: { reason: string; manual: boolean },
) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, registration: { event: memberOf(userId) } },
    include: { refund: true, registration: { select: { eventId: true } } },
  });
  if (!payment) throw new UserError("Pagamento não encontrado");
  if (payment.status !== "SUCCEEDED") throw new UserError("Só se reembolsam pagamentos concluídos");
  if (payment.refund && payment.refund.status !== "FAILED") throw new UserError("Este pagamento já tem um reembolso");
  const reason = input.reason.trim();
  if (reason.length < 3) throw new UserError("Indique o motivo do reembolso");
  if (reason.length > 300) throw new UserError("O motivo pode ter no máximo 300 caracteres");
  if (!input.manual && !payment.providerRef) throw new UserError("Este pagamento não tem referência no provedor");

  // Uma tentativa falhada é reaproveitada: o paymentId só pode ter um reembolso.
  const data = {
    status: "PENDING" as const,
    manual: input.manual,
    reason,
    requestedById: userId,
    providerRef: null,
    failureReason: null,
    settledAt: null,
  };
  const refund = await prisma.refund.upsert({
    where: { paymentId: payment.id },
    update: data,
    create: { ...data, paymentId: payment.id },
  });

  if (input.manual) {
    await settleRefund(refund.id, { status: "SUCCEEDED" });
    return payment.registration.eventId;
  }

  try {
    const started = await providerFor(payment.provider).refund({
      refundId: refund.id,
      providerRef: payment.providerRef!,
      appUrl: appUrl(),
    });
    await prisma.refund.update({ where: { id: refund.id }, data: { providerRef: started.refundRef } });
    await settleRefund(refund.id, started.outcome);
    return payment.registration.eventId;
  } catch (error) {
    console.error(`Reembolso ${refund.id} do pagamento ${payment.id} falhou`, error);
    await settleRefund(refund.id, { status: "FAILED", reason: "O provedor não aceitou o pedido de devolução" });
    throw new UserError(
      "O provedor de pagamento não aceitou a devolução. Tente de novo ou registe-a como devolvida fora da plataforma.",
    );
  }
}

/** Pergunta ao provedor como está uma devolução pendente. */
export async function refreshRefund(refundId: string) {
  const refund = await prisma.refund.findUnique({ where: { id: refundId }, include: { payment: true } });
  if (!refund || refund.status !== "PENDING" || refund.manual || !refund.providerRef) return;
  try {
    await settleRefund(refund.id, await providerFor(refund.payment.provider).checkRefund(refund.providerRef));
  } catch (error) {
    console.error(`Não foi possível consultar o reembolso ${refund.id}`, error);
  }
}

/** Callback do Multicaixa Express: a transação pode ser uma devolução. */
export async function refreshRefundByProviderRef(provider: "MULTICAIXA_EXPRESS" | "PAYPAL", providerRef: string) {
  const refund = await prisma.refund.findFirst({ where: { providerRef, payment: { provider } } });
  if (refund) await refreshRefund(refund.id);
}

/**
 * Cancela uma inscrição sem dinheiro por devolver: por pagar, gratuita ou feita à mão.
 * Uma inscrição paga cancela-se reembolsando o pagamento.
 */
export async function cancelRegistration(userId: string, registrationId: string) {
  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, event: memberOf(userId) },
    include: { payments: true },
  });
  if (!registration) throw new UserError("Inscrição não encontrada");
  if (registration.status === "CANCELLED") return registration.eventId;
  if (registration.payments.some((payment) => payment.status === "SUCCEEDED")) {
    throw new UserError("Esta inscrição foi paga: cancele-a reembolsando o pagamento");
  }
  if (registration.payments.some((payment) => payment.status === "PENDING" && payment.provider === "MULTICAIXA_EXPRESS")) {
    throw new UserError("Há um pagamento Multicaixa Express à espera de confirmação. Aguarde que termine.");
  }
  await prisma.$transaction([
    prisma.payment.updateMany({
      where: { registrationId: registration.id, status: "PENDING" },
      data: { status: "FAILED", failureReason: "Inscrição cancelada pelo organizador", settledAt: new Date() },
    }),
    prisma.registration.update({ where: { id: registration.id }, data: { status: "CANCELLED" } }),
  ]);
  return registration.eventId;
}
