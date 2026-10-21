import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { membershipValidUntil, premiumActive } from "@/lib/federation-rules";
import { UTC_OFFSET } from "@/lib/format";
import { normalizeAngolanMobile } from "@/lib/phone";
import { deliverEmail } from "./email";
import { kv } from "./kv";
import { membershipActiveEmail, membershipRefundedEmail } from "./notifications";
import { appUrl, availableProviders, getProvider, providerFor } from "./payments";
import type { Outcome } from "./payments/types";

// Filiação individual de atletas numa federação (plano Premium). O pagamento segue as mesmas regras
// das inscrições: o estado vem sempre do provedor, nunca do navegador nem do callback.
// A Camps não fica com nenhuma parte das quotas: vão inteiras para a federação (repasses).

/** Filiação ativa de um atleta numa federação, válida numa data (ex.: o dia do evento). */
export function activeMembership(athleteId: string, federationId: string, at: Date) {
  return prisma.membership.findFirst({
    where: { athleteId, federationId, status: "ACTIVE", validFrom: { lte: at }, validUntil: { gte: at } },
    orderBy: { validUntil: "desc" },
  });
}

export async function getJoinContext(userId: string | null, slug: string) {
  const federation = await prisma.federation.findUnique({
    where: { slug },
    include: { plans: { where: { active: true }, orderBy: { priceCents: "asc" } } },
  });
  if (!federation || !premiumActive(federation)) return null;
  const athletes = userId
    ? await prisma.athleteProfile.findMany({
        where: { userId },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        include: {
          memberships: {
            where: { federationId: federation.id, status: "ACTIVE", validUntil: { gte: new Date() } },
            select: { validUntil: true },
          },
        },
      })
    : [];
  return { federation, athletes, providers: availableProviders().map(({ id, label }) => ({ id, label })) };
}

export type MembershipInput = {
  planId: string;
  athleteId: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string;
  academyName: string;
  provider: string;
  mobile: string;
};

export type MembershipStarted = { membershipId: string; redirectUrl?: string };

export async function startMembership(userId: string, slug: string, input: MembershipInput): Promise<MembershipStarted> {
  const context = await getJoinContext(userId, slug);
  if (!context) throw new UserError("Esta federação não aceita filiações online");
  const plan = context.federation.plans.find((candidate) => candidate.id === input.planId);
  if (!plan) throw new UserError("Escolha um plano de filiação");

  const athlete = input.athleteId
    ? await prisma.athleteProfile.findFirst({ where: { id: input.athleteId, userId } })
    : await createAthlete(userId, input);
  if (!athlete) throw new UserError("Atleta não encontrado");

  const now = new Date();
  if (plan.maxAge !== null && now.getUTCFullYear() - athlete.birthDate.getUTCFullYear() > plan.maxAge) {
    throw new UserError(`Este plano é só até aos ${plan.maxAge} anos`);
  }
  if (await activeMembership(athlete.id, context.federation.id, now)) {
    throw new UserError("Este atleta já tem uma filiação ativa nesta federação");
  }

  if (plan.priceCents === 0) {
    const membership = await prisma.membership.create({
      data: {
        federationId: context.federation.id,
        planId: plan.id,
        athleteId: athlete.id,
        boughtById: userId,
        priceCents: 0,
        status: "ACTIVE",
        validFrom: now,
        validUntil: membershipValidUntil(now, plan.months),
      },
    });
    return { membershipId: membership.id };
  }

  const { provider, mobile } = requireProvider(input.provider, input.mobile);
  const membership = await prisma.membership.create({
    data: { federationId: context.federation.id, planId: plan.id, athleteId: athlete.id, boughtById: userId, priceCents: plan.priceCents },
  });
  return startMembershipPayment(userId, membership.id, provider.id, mobile ?? "");
}

async function createAthlete(userId: string, input: MembershipInput) {
  if (!input.firstName.trim() || !input.lastName.trim()) throw new UserError("Indique o nome e o apelido do atleta");
  if (input.gender !== "MALE" && input.gender !== "FEMALE") throw new UserError("Indique o sexo do atleta");
  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(input.birthDate) ? new Date(`${input.birthDate}T12:00:00${UTC_OFFSET}`) : new Date(NaN);
  if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) throw new UserError("Indique a data de nascimento do atleta");
  const academyName = input.academyName.trim();
  const academy = academyName
    ? ((await prisma.academy.findFirst({ where: { name: { equals: academyName, mode: "insensitive" } } })) ??
      (await prisma.academy.create({ data: { name: academyName, country: "AO" } })))
    : null;
  return prisma.athleteProfile.create({
    data: {
      userId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      birthDate,
      gender: input.gender,
      country: "AO",
      academyId: academy?.id,
    },
  });
}

function requireProvider(providerId: string, mobileInput: string) {
  const provider = getProvider(providerId);
  if (!provider) throw new UserError("Escolha um método de pagamento");
  const mobile = provider.id === "MULTICAIXA_EXPRESS" ? normalizeAngolanMobile(mobileInput) : null;
  if (provider.id === "MULTICAIXA_EXPRESS" && !mobile) {
    throw new UserError("Informe um número de telemóvel angolano válido (9 dígitos, a começar por 9)");
  }
  return { provider, mobile };
}

/** Abre (ou volta a tentar) o pagamento de uma filiação por pagar. */
export async function startMembershipPayment(
  userId: string,
  membershipId: string,
  providerId: string,
  mobileInput: string,
): Promise<MembershipStarted> {
  const { provider, mobile } = requireProvider(providerId, mobileInput);
  const pending = await prisma.membershipPayment.findMany({
    where: { membershipId, status: "PENDING", membership: { boughtById: userId } },
  });
  for (const payment of pending) await refreshMembershipPayment(payment.id);

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, boughtById: userId },
    include: { federation: true, athlete: true, plan: true, payments: { where: { status: "PENDING" } } },
  });
  if (!membership) throw new UserError("Filiação não encontrada");
  if (membership.status !== "PENDING") return { membershipId };
  if (membership.payments.some((payment) => payment.provider === "MULTICAIXA_EXPRESS")) {
    throw new UserError("Já existe um pedido à espera de confirmação na app Multicaixa Express. Confirme-o ou aguarde que expire.");
  }
  await prisma.membershipPayment.updateMany({
    where: { membershipId, status: "PENDING" },
    data: { status: "FAILED", failureReason: "Substituído por uma nova tentativa", settledAt: new Date() },
  });

  const payment = await prisma.membershipPayment.create({
    data: { membershipId, provider: provider.id, amountCents: membership.priceCents, chargeCurrency: "AOA", chargeAmountCents: membership.priceCents },
  });
  try {
    const started = await provider.start({
      paymentId: payment.id,
      amountCents: membership.priceCents,
      currency: "AOA",
      description: `Filiação ${membership.federation.name} — ${membership.athlete.firstName} ${membership.athlete.lastName}`,
      mobile,
      appUrl: appUrl(),
    });
    await prisma.membershipPayment.update({
      where: { id: payment.id },
      data: { providerRef: started.providerRef, chargeCurrency: started.chargeCurrency, chargeAmountCents: started.chargeAmountCents },
    });
    return { membershipId, redirectUrl: started.redirectUrl };
  } catch (error) {
    const reason = error instanceof UserError ? error.message : "Falha ao contactar o provedor de pagamento";
    await settleMembershipPayment(payment.id, { status: "FAILED", reason });
    if (error instanceof UserError) throw error;
    console.error(`Pagamento de filiação ${payment.id} (${provider.id}) não arrancou`, error);
    throw new UserError("Não foi possível iniciar o pagamento. Tente novamente dentro de instantes.");
  }
}

/** Grava o desfecho uma única vez e, se foi pago, ativa a filiação a partir de hoje. */
async function settleMembershipPayment(paymentId: string, outcome: Outcome) {
  if (outcome.status === "PENDING") return;
  const emailId = await prisma.$transaction(async (tx) => {
    const { count } = await tx.membershipPayment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: outcome.status, failureReason: outcome.status === "FAILED" ? outcome.reason : null, settledAt: new Date() },
    });
    if (count === 0 || outcome.status !== "SUCCEEDED") return null;
    const payment = await tx.membershipPayment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { membership: { include: { plan: true } } },
    });
    const now = new Date();
    await tx.membership.update({
      where: { id: payment.membershipId },
      data: { status: "ACTIVE", validFrom: now, validUntil: membershipValidUntil(now, payment.membership.plan.months) },
    });
    return membershipActiveEmail(tx, payment.membershipId, payment.amountCents);
  });
  if (emailId) await deliverEmail(emailId);
}

export async function refreshMembershipPayment(paymentId: string, options: { force?: boolean } = {}) {
  const payment = await prisma.membershipPayment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== "PENDING" || !payment.providerRef) return;
  const checks = await (await kv()).incr(`paycheck:${payment.id}`, 3_000);
  if (checks > 1 && !options.force) return;
  try {
    await settleMembershipPayment(payment.id, await providerFor(payment.provider).check(payment.providerRef));
  } catch (error) {
    console.error(`Não foi possível consultar o pagamento de filiação ${payment.id}`, error);
  }
}

/** Retorno ou callback do provedor para um pagamento de filiação (ou null se não for um). */
export async function refreshMembershipByProviderRef(provider: "MULTICAIXA_EXPRESS" | "PAYPAL", providerRef: string) {
  const payment = await prisma.membershipPayment.findUnique({ where: { provider_providerRef: { provider, providerRef } } });
  if (payment) await refreshMembershipPayment(payment.id);
  return payment;
}

export async function abandonPayPalMembershipPayment(paymentId: string) {
  await refreshMembershipPayment(paymentId);
  await prisma.membershipPayment.updateMany({
    where: { id: paymentId, provider: "PAYPAL", status: "PENDING" },
    data: { status: "FAILED", failureReason: "Pagamento cancelado no PayPal", settledAt: new Date() },
  });
  return prisma.membershipPayment.findUnique({ where: { id: paymentId } });
}

export async function expireStaleMembershipPayment(paymentId: string) {
  const payment = await prisma.membershipPayment.findUnique({ where: { id: paymentId }, select: { status: true } });
  if (payment?.status !== "PENDING") return false;
  await settleMembershipPayment(paymentId, { status: "FAILED", reason: "O pagamento expirou sem confirmação" });
  return true;
}

export async function simulateMembershipPayment(userId: string, paymentId: string, approve: boolean) {
  if (!getProvider("SIMULATOR")) throw new UserError("O simulador de pagamentos está desligado");
  const payment = await prisma.membershipPayment.findFirst({
    where: { id: paymentId, provider: "SIMULATOR", membership: { boughtById: userId } },
  });
  if (!payment) throw new UserError("Pagamento não encontrado");
  await settleMembershipPayment(payment.id, approve ? { status: "SUCCEEDED" } : { status: "FAILED", reason: "Recusado no simulador" });
}

export async function getMyMembership(userId: string, membershipId: string) {
  const where = { id: membershipId, boughtById: userId };
  const pending = await prisma.membershipPayment.findMany({ where: { membership: where, status: "PENDING" } });
  for (const payment of pending) await refreshMembershipPayment(payment.id);
  const membership = await prisma.membership.findFirst({
    where,
    include: {
      federation: { select: { name: true, slug: true } },
      plan: { select: { name: true, months: true } },
      athlete: { select: { firstName: true, lastName: true } },
      payments: { orderBy: { createdAt: "desc" }, include: { refund: { select: { status: true, reason: true } } } },
    },
  });
  if (!membership) return null;
  return { membership, providers: availableProviders().map(({ id, label }) => ({ id, label })) };
}

export function listMyMemberships(userId: string) {
  return prisma.membership.findMany({
    where: { boughtById: userId },
    orderBy: { createdAt: "desc" },
    include: {
      federation: { select: { name: true, slug: true } },
      plan: { select: { name: true } },
      athlete: { select: { firstName: true, lastName: true } },
    },
  });
}

// ---------- Reembolsos de quotas ----------
// Sempre do valor total (a OPG da ProxyPay não faz parciais) e só pedidos por quem gere a
// federação. Quando a devolução se confirma, a quota fica REFUNDED e a filiação é cancelada.

async function settleMembershipRefund(refundId: string, outcome: Outcome) {
  if (outcome.status === "PENDING") return;
  const emailId = await prisma.$transaction(async (tx) => {
    const { count } = await tx.membershipRefund.updateMany({
      where: { id: refundId, status: "PENDING" },
      data: { status: outcome.status, failureReason: outcome.status === "FAILED" ? outcome.reason : null, settledAt: new Date() },
    });
    if (count === 0 || outcome.status !== "SUCCEEDED") return null;
    const refund = await tx.membershipRefund.findUniqueOrThrow({ where: { id: refundId }, include: { payment: true } });
    await tx.membershipPayment.update({ where: { id: refund.paymentId }, data: { status: "REFUNDED" } });
    await tx.membership.update({ where: { id: refund.payment.membershipId }, data: { status: "CANCELLED" } });
    return membershipRefundedEmail(tx, refund.payment.membershipId, refund.payment.amountCents, refund.manual);
  });
  if (emailId) await deliverEmail(emailId);
}

/**
 * Devolve uma quota paga. `manual` regista uma devolução feita fora da plataforma; sem ele,
 * a devolução é pedida ao provedor que cobrou. Devolve o slug da federação.
 */
export async function requestMembershipRefund(userId: string, paymentId: string, input: { reason: string; manual: boolean }) {
  const payment = await prisma.membershipPayment.findFirst({
    where: { id: paymentId, membership: { federation: { members: { some: { userId } } } } },
    include: { refund: true, membership: { select: { federation: { select: { slug: true } } } } },
  });
  if (!payment) throw new UserError("Pagamento não encontrado");
  if (payment.status !== "SUCCEEDED") throw new UserError("Só se reembolsam quotas pagas");
  if (payment.refund && payment.refund.status !== "FAILED") throw new UserError("Esta quota já tem um reembolso");
  const reason = input.reason.trim();
  if (reason.length < 3) throw new UserError("Indique o motivo do reembolso");
  if (reason.length > 300) throw new UserError("O motivo pode ter no máximo 300 caracteres");
  if (!input.manual && !payment.providerRef) throw new UserError("Este pagamento não tem referência no provedor");

  // Uma tentativa falhada é reaproveitada: cada quota só pode ter um reembolso.
  const data = { status: "PENDING" as const, manual: input.manual, reason, requestedById: userId, providerRef: null, failureReason: null, settledAt: null };
  const refund = await prisma.membershipRefund.upsert({
    where: { paymentId: payment.id },
    update: data,
    create: { ...data, paymentId: payment.id },
  });
  const slug = payment.membership.federation.slug;

  if (input.manual) {
    await settleMembershipRefund(refund.id, { status: "SUCCEEDED" });
    return slug;
  }
  try {
    const started = await providerFor(payment.provider).refund({ refundId: refund.id, providerRef: payment.providerRef!, appUrl: appUrl() });
    await prisma.membershipRefund.update({ where: { id: refund.id }, data: { providerRef: started.refundRef } });
    await settleMembershipRefund(refund.id, started.outcome);
    return slug;
  } catch (error) {
    console.error(`Reembolso ${refund.id} da quota ${payment.id} falhou`, error);
    await settleMembershipRefund(refund.id, { status: "FAILED", reason: "O provedor não aceitou o pedido de devolução" });
    throw new UserError("O provedor de pagamento não aceitou a devolução. Tente de novo ou registe-a como devolvida fora da plataforma.");
  }
}

export async function refreshMembershipRefund(refundId: string) {
  const refund = await prisma.membershipRefund.findUnique({ where: { id: refundId }, include: { payment: true } });
  if (!refund || refund.status !== "PENDING" || refund.manual || !refund.providerRef) return;
  try {
    await settleMembershipRefund(refund.id, await providerFor(refund.payment.provider).checkRefund(refund.providerRef));
  } catch (error) {
    console.error(`Não foi possível consultar o reembolso de quota ${refund.id}`, error);
  }
}

/** Callback do Multicaixa Express: a transação pode ser a devolução de uma quota. */
export async function refreshMembershipRefundByProviderRef(provider: "MULTICAIXA_EXPRESS" | "PAYPAL", providerRef: string) {
  const refund = await prisma.membershipRefund.findFirst({ where: { providerRef, payment: { provider } } });
  if (refund) await refreshMembershipRefund(refund.id);
  return refund;
}
