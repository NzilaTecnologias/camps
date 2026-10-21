import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { extendPlan, PLAN_LABEL } from "@/lib/federation-rules";
import { normalizeAngolanMobile } from "@/lib/phone";
import { federationPlanPriceCents } from "./billing-config";
import { requireFederation } from "./federations";
import { afterIssue, invoiceFederationPlan } from "./invoicing";
import { kv } from "./kv";
import { appUrl, availableProviders, getProvider, providerFor } from "./payments";
import type { Outcome } from "./payments/types";

// Assinatura do Plano Federação paga online, pelos mesmos provedores das inscrições. Quando o
// pagamento se confirma, o plano fica ativo (ou é prolongado) por 12 meses e sai a fatura.
// O administrador continua a poder ativá-lo à mão para quem paga por transferência.

const PLAN_MONTHS = 12;
const PLANS = ["BASIC", "PREMIUM"] as const;

export async function getPlanContext(userId: string, federationId: string) {
  const federation = await requireFederation(userId, federationId);
  const pending = await prisma.federationPlanPayment.findMany({ where: { federationId, status: "PENDING" }, select: { id: true } });
  for (const payment of pending) await refreshPlanPayment(payment.id);
  const [payments, billing] = await Promise.all([
    prisma.federationPlanPayment.findMany({ where: { federationId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.federation.findUniqueOrThrow({
      where: { id: federationId },
      select: { plan: true, planExpiresAt: true, billingName: true, billingNif: true, billingAddress: true },
    }),
  ]);
  return {
    federation: { ...federation, ...billing },
    payments,
    prices: { BASIC: federationPlanPriceCents("BASIC"), PREMIUM: federationPlanPriceCents("PREMIUM") },
    months: PLAN_MONTHS,
    providers: availableProviders().map((provider) => ({ id: provider.id, label: provider.label })),
  };
}

/** Abre o pagamento de 12 meses do plano escolhido. Devolve para onde mandar o utilizador (PayPal), se for o caso. */
export async function startPlanPayment(
  userId: string,
  federationId: string,
  input: { plan: string; provider: string; mobile: string },
): Promise<{ redirectUrl?: string }> {
  const federation = await requireFederation(userId, federationId);
  const plan = PLANS.find((value) => value === input.plan);
  if (!plan) throw new UserError("Escolha o plano");
  const provider = getProvider(input.provider);
  if (!provider) throw new UserError("Escolha um método de pagamento");
  const mobile = provider.id === "MULTICAIXA_EXPRESS" ? normalizeAngolanMobile(input.mobile) : null;
  if (provider.id === "MULTICAIXA_EXPRESS" && !mobile) {
    throw new UserError("Informe um número de telemóvel angolano válido (9 dígitos, a começar por 9)");
  }

  const pending = await prisma.federationPlanPayment.findMany({ where: { federationId, status: "PENDING" } });
  for (const payment of pending) await refreshPlanPayment(payment.id);
  if (await prisma.federationPlanPayment.count({ where: { federationId, status: "PENDING", provider: "MULTICAIXA_EXPRESS" } })) {
    throw new UserError("Já existe um pedido à espera de confirmação na app Multicaixa Express. Confirme-o ou aguarde que expire.");
  }
  await prisma.federationPlanPayment.updateMany({
    where: { federationId, status: "PENDING" },
    data: { status: "FAILED", failureReason: "Substituído por uma nova tentativa", settledAt: new Date() },
  });

  const amountCents = federationPlanPriceCents(plan);
  const payment = await prisma.federationPlanPayment.create({
    data: {
      federationId,
      plan,
      months: PLAN_MONTHS,
      paidById: userId,
      provider: provider.id,
      amountCents,
      chargeCurrency: "AOA",
      chargeAmountCents: amountCents,
    },
  });
  try {
    const started = await provider.start({
      paymentId: payment.id,
      amountCents,
      currency: "AOA",
      description: `Plano Federação ${PLAN_LABEL[plan]} (${PLAN_MONTHS} meses) — ${federation.name}`,
      mobile,
      appUrl: appUrl(),
    });
    await prisma.federationPlanPayment.update({
      where: { id: payment.id },
      data: { providerRef: started.providerRef, chargeCurrency: started.chargeCurrency, chargeAmountCents: started.chargeAmountCents },
    });
    return { redirectUrl: started.redirectUrl };
  } catch (error) {
    const reason = error instanceof UserError ? error.message : "Falha ao contactar o provedor de pagamento";
    await settlePlanPayment(payment.id, { status: "FAILED", reason });
    if (error instanceof UserError) throw error;
    console.error(`Pagamento do plano ${payment.id} (${provider.id}) não arrancou`, error);
    throw new UserError("Não foi possível iniciar o pagamento. Tente novamente dentro de instantes.");
  }
}

const PROVIDER_LABEL = { MULTICAIXA_EXPRESS: "Multicaixa Express", PAYPAL: "PayPal", SIMULATOR: "Simulador" } as const;

/** Grava o desfecho uma única vez; se foi pago, prolonga o plano e emite a fatura na mesma transação. */
async function settlePlanPayment(paymentId: string, outcome: Outcome) {
  if (outcome.status === "PENDING") return;
  const issued = await prisma.$transaction(async (tx) => {
    const { count } = await tx.federationPlanPayment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: outcome.status, failureReason: outcome.status === "FAILED" ? outcome.reason : null, settledAt: new Date() },
    });
    if (count === 0 || outcome.status !== "SUCCEEDED") return null;
    const payment = await tx.federationPlanPayment.findUniqueOrThrow({ where: { id: paymentId } });
    const federation = await tx.federation.findUniqueOrThrow({
      where: { id: payment.federationId },
      select: { plan: true, planExpiresAt: true },
    });
    await tx.federation.update({ where: { id: payment.federationId }, data: extendPlan(federation, payment.plan, payment.months) });
    return invoiceFederationPlan(tx, {
      federationId: payment.federationId,
      plan: payment.plan,
      months: payment.months,
      amountCents: payment.amountCents,
      paidVia: `Pago por ${PROVIDER_LABEL[payment.provider]}`,
    });
  });
  await afterIssue(issued);
}

/** Pergunta ao provedor por um pagamento pendente (no máximo uma vez a cada 3 s, salvo `force`). */
export async function refreshPlanPayment(paymentId: string, options: { force?: boolean } = {}) {
  const payment = await prisma.federationPlanPayment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== "PENDING" || !payment.providerRef) return;
  const checks = await (await kv()).incr(`paycheck:${payment.id}`, 3_000);
  if (checks > 1 && !options.force) return;
  try {
    await settlePlanPayment(payment.id, await providerFor(payment.provider).check(payment.providerRef));
  } catch (error) {
    console.error(`Não foi possível consultar o pagamento do plano ${payment.id}`, error);
  }
}

/** Callback ou retorno do provedor: devolve o pagamento se for de um plano, senão null. */
export async function refreshPlanByProviderRef(provider: "MULTICAIXA_EXPRESS" | "PAYPAL", providerRef: string) {
  const payment = await prisma.federationPlanPayment.findUnique({ where: { provider_providerRef: { provider, providerRef } } });
  if (payment) await refreshPlanPayment(payment.id);
  return payment;
}

export async function abandonPayPalPlanPayment(paymentId: string) {
  await refreshPlanPayment(paymentId);
  await prisma.federationPlanPayment.updateMany({
    where: { id: paymentId, provider: "PAYPAL", status: "PENDING" },
    data: { status: "FAILED", failureReason: "Pagamento cancelado no PayPal", settledAt: new Date() },
  });
  return prisma.federationPlanPayment.findUnique({ where: { id: paymentId } });
}

export async function expireStalePlanPayment(paymentId: string) {
  const payment = await prisma.federationPlanPayment.findUnique({ where: { id: paymentId }, select: { status: true } });
  if (payment?.status !== "PENDING") return false;
  await settlePlanPayment(paymentId, { status: "FAILED", reason: "O pagamento expirou sem confirmação" });
  return true;
}

export async function simulatePlanPayment(userId: string, paymentId: string, approve: boolean) {
  if (!getProvider("SIMULATOR")) throw new UserError("O simulador de pagamentos está desligado");
  const payment = await prisma.federationPlanPayment.findFirst({ where: { id: paymentId, provider: "SIMULATOR" } });
  if (!payment) throw new UserError("Pagamento não encontrado");
  const federation = await requireFederation(userId, payment.federationId);
  await settlePlanPayment(payment.id, approve ? { status: "SUCCEEDED" } : { status: "FAILED", reason: "Recusado no simulador" });
  return federation.slug;
}
