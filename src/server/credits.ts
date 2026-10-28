import type { Prisma } from "@/generated/prisma/client";
import { quoteCredits, parseCreditAmount, CREDIT_PACKS, MAX_PURCHASE, MIN_PURCHASE, WELCOME_CREDITS } from "@/lib/credits";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { count } from "@/lib/format";
import { rolesWith } from "@/lib/organizer-permissions";
import { normalizeAngolanMobile } from "@/lib/phone";
import { can } from "@/lib/admin-permissions";
import { audit, type Staff } from "./admin/session";
import { creditPriceCents } from "./billing-config";
import { afterIssue, invoiceCredits, listOrganizerInvoices } from "./invoicing";
import { kv } from "./kv";
import { appUrl, getProvider, paymentMethods, PLATFORM, providerFor, simulatorEnabled } from "./payments";
import type { Outcome } from "./payments/types";

// Créditos das organizações (regras em lib/credits.ts). Cada atleta confirmado gasta 1 crédito
// por evento, no momento em que a inscrição fica confirmada (paga, gratuita ou feita à mão). Sem
// saldo, a inscrição confirma-se na mesma e o atleta fica "por cobrar": a gestão do evento fica
// parada (requireCredits) até a organização comprar os créditos em falta, que são logo gastos.

type Tx = Prisma.TransactionClient;

/**
 * Os créditos de boas-vindas, na mesma transação que cria a organização. Ficam bloqueados
 * (welcomeCredits) e só passam para o saldo com a primeira compra (unlockWelcomeCredits).
 */
export async function grantWelcomeCredits(tx: Tx, organizerId: string) {
  await tx.organizer.update({ where: { id: organizerId }, data: { welcomeCredits: WELCOME_CREDITS } });
}

/**
 * Na transação de uma compra paga, depois de somar os créditos comprados (a linha da organização
 * já está trancada): passa para o saldo os créditos de boas-vindas que estavam bloqueados.
 */
async function unlockWelcomeCredits(tx: Tx, organizerId: string, purchased: number) {
  if (purchased < MIN_PURCHASE) return;
  const { welcomeCredits } = await tx.organizer.findUniqueOrThrow({ where: { id: organizerId }, select: { welcomeCredits: true } });
  if (welcomeCredits === 0) return;
  const { credits } = await tx.organizer.update({
    where: { id: organizerId },
    data: { credits: { increment: welcomeCredits }, welcomeCredits: 0 },
    select: { credits: true },
  });
  await tx.creditTransaction.create({
    data: { organizerId, kind: "WELCOME", delta: welcomeCredits, balance: credits, note: "Oferta de boas-vindas, desbloqueada com a primeira compra" },
  });
}

/**
 * Gasta o crédito de um atleta confirmado num evento. Só uma vez por atleta e evento: o movimento
 * grava-se primeiro (único por evento e atleta) e só depois se desconta o saldo, por isso duas
 * confirmações ao mesmo tempo nunca gastam dois créditos nem deixam o saldo errado.
 */
export async function chargeAthlete(tx: Tx, eventId: string, athleteId: string): Promise<"charged" | "already" | "due"> {
  const event = await tx.event.findUniqueOrThrow({ where: { id: eventId }, select: { organizerId: true } });
  const inserted = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO "CreditTransaction" ("id", "organizerId", "kind", "delta", "balance", "eventId", "athleteId")
    VALUES (gen_random_uuid()::text, ${event.organizerId}, 'ATHLETE', -1, 0, ${eventId}, ${athleteId})
    ON CONFLICT ("eventId", "athleteId") DO NOTHING
    RETURNING "id"`;
  if (inserted.length === 0) return "already";
  const [left] = await tx.$queryRaw<{ credits: number }[]>`
    UPDATE "Organizer" SET "credits" = "credits" - 1
     WHERE "id" = ${event.organizerId} AND "credits" > 0
    RETURNING "credits"`;
  if (!left) {
    await tx.creditTransaction.delete({ where: { id: inserted[0].id } });
    return "due";
  }
  await tx.creditTransaction.update({ where: { id: inserted[0].id }, data: { balance: left.credits } });
  return "charged";
}

/** Atletas confirmados num evento que ainda não gastaram crédito. */
export async function creditsDue(eventId: string): Promise<number> {
  const [row] = await prisma.$queryRaw<{ due: bigint }[]>`
    SELECT COUNT(*) AS due
      FROM (SELECT DISTINCT "athleteId" FROM "Registration" WHERE "eventId" = ${eventId} AND "confirmedAt" IS NOT NULL) r
     WHERE NOT EXISTS (SELECT 1 FROM "CreditTransaction" c WHERE c."eventId" = ${eventId} AND c."athleteId" = r."athleteId")`;
  return Number(row?.due ?? 0);
}

/** Gasta o saldo nos atletas por cobrar da organização, dos eventos mais próximos primeiro. */
export async function settleDueCredits(organizerId: string): Promise<number> {
  const organizer = await prisma.organizer.findUnique({ where: { id: organizerId }, select: { credits: true } });
  if (!organizer || organizer.credits <= 0) return 0;
  const due = await prisma.$queryRaw<{ eventId: string; athleteId: string }[]>`
    SELECT r."eventId", r."athleteId"
      FROM "Registration" r
      JOIN "Event" e ON e."id" = r."eventId"
     WHERE e."organizerId" = ${organizerId} AND r."confirmedAt" IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM "CreditTransaction" c WHERE c."eventId" = r."eventId" AND c."athleteId" = r."athleteId")
     GROUP BY r."eventId", r."athleteId", e."startsAt"
     ORDER BY e."startsAt" ASC, MIN(r."confirmedAt") ASC
     LIMIT ${organizer.credits}`;
  let charged = 0;
  for (const { eventId, athleteId } of due) {
    const result = await prisma.$transaction((tx) => chargeAthlete(tx, eventId, athleteId));
    if (result === "due") break;
    if (result === "charged") charged++;
  }
  return charged;
}

/**
 * Para as ações que gerem o evento (gerar chaves, programar, chamar lutas): recusa enquanto
 * houver atletas confirmados sem crédito. Antes gasta o saldo que houver.
 */
export async function requireCredits(eventId: string) {
  if ((await creditsDue(eventId)) === 0) return;
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { organizerId: true } });
  await settleDueCredits(event.organizerId);
  const due = await creditsDue(eventId);
  if (due > 0) {
    throw new UserError(
      `Faltam ${count(due, "crédito", "créditos")} para gerir este evento: cada atleta confirmado gasta 1. Compre-os em Créditos e volte a tentar. As inscrições continuam a entrar.`,
    );
  }
}

/** Resumo dos créditos de um evento, para o painel dele. */
export async function getEventCredits(eventId: string) {
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { organizer: { select: { id: true, name: true, credits: true } } },
  });
  const [[{ athletes }], charged, due] = await Promise.all([
    prisma.$queryRaw<{ athletes: bigint }[]>`
      SELECT COUNT(DISTINCT "athleteId") AS athletes FROM "Registration" WHERE "eventId" = ${eventId} AND "confirmedAt" IS NOT NULL`,
    prisma.creditTransaction.count({ where: { eventId, kind: "ATHLETE" } }),
    creditsDue(eventId),
  ]);
  return { organizer: event.organizer, athletes: Number(athletes), charged, due };
}

// ---------- Compra de créditos (paga à Camps, com as contas da Camps) ----------

async function requireCreditsAccess(userId: string, organizerId: string) {
  const member = await prisma.organizerMember.findFirst({
    where: { organizerId, userId, role: { in: rolesWith("money") } },
    select: { organizer: { select: { id: true, name: true, credits: true, welcomeCredits: true, billingName: true, billingNif: true, billingAddress: true } } },
  });
  if (!member) throw new UserError("Só o dono e os gestores da organização compram créditos");
  return member.organizer;
}

/** Tudo o que a página Créditos da organização mostra. */
export async function getCreditsPage(userId: string, organizerId: string) {
  await requireCreditsAccess(userId, organizerId);
  const pending = await prisma.creditPurchase.findMany({ where: { organizerId, status: "PENDING" }, select: { id: true } });
  for (const purchase of pending) await refreshCreditPurchase(purchase.id);
  // Compras confirmadas noutro lado (callback, tarefa de fundo) já gastaram o saldo; isto apanha o resto.
  await settleDueCredits(organizerId);

  const organizer = await requireCreditsAccess(userId, organizerId);
  const [transactions, purchases, invoices, dueRows] = await Promise.all([
    prisma.creditTransaction.findMany({ where: { organizerId }, orderBy: { createdAt: "desc" }, take: 60 }),
    prisma.creditPurchase.findMany({ where: { organizerId }, orderBy: { createdAt: "desc" }, take: 20 }),
    listOrganizerInvoices(organizerId),
    prisma.$queryRaw<{ eventId: string; name: string; due: bigint }[]>`
      SELECT e."id" AS "eventId", e."name", COUNT(DISTINCT r."athleteId") AS due
        FROM "Registration" r JOIN "Event" e ON e."id" = r."eventId"
       WHERE e."organizerId" = ${organizerId} AND r."confirmedAt" IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM "CreditTransaction" c WHERE c."eventId" = r."eventId" AND c."athleteId" = r."athleteId")
       GROUP BY e."id", e."name"
       ORDER BY e."name"`,
  ]);
  const eventIds = [...new Set(transactions.flatMap((t) => (t.eventId ? [t.eventId] : [])))];
  const events = await prisma.event.findMany({ where: { id: { in: eventIds } }, select: { id: true, name: true } });
  const eventName = new Map(events.map((event) => [event.id, event.name]));
  const base = creditPriceCents();
  return {
    organizer,
    transactions: transactions.map((t) => ({ ...t, eventName: t.eventId ? (eventName.get(t.eventId) ?? null) : null })),
    purchases,
    invoices,
    due: dueRows.map((row) => ({ eventId: row.eventId, name: row.name, due: Number(row.due) })),
    baseUnitCents: base,
    packs: CREDIT_PACKS.map((pack) => quoteCredits(pack.credits, base)),
    providers: paymentMethods(PLATFORM).map((provider) => ({ id: provider.id, label: provider.label })),
  };
}

/** Abre o pagamento de uma compra de créditos. Devolve para onde mandar o utilizador (PayPal), se for o caso. */
export async function startCreditPurchase(
  userId: string,
  organizerId: string,
  input: { credits: string; provider: string; mobile: string },
): Promise<{ redirectUrl?: string }> {
  const organizer = await requireCreditsAccess(userId, organizerId);
  const credits = parseCreditAmount(input.credits);
  if (!credits) throw new UserError(`Escolha entre ${MIN_PURCHASE} e ${MAX_PURCHASE.toLocaleString("pt-PT")} créditos`);
  const provider = getProvider(PLATFORM, input.provider);
  if (!provider) throw new UserError("Escolha um método de pagamento");
  const mobile = provider.id === "MULTICAIXA_EXPRESS" ? normalizeAngolanMobile(input.mobile) : null;
  if (provider.id === "MULTICAIXA_EXPRESS" && !mobile) {
    throw new UserError("Informe um número de telemóvel angolano válido (9 dígitos, a começar por 9)");
  }

  const pending = await prisma.creditPurchase.findMany({ where: { organizerId, status: "PENDING" } });
  for (const purchase of pending) await refreshCreditPurchase(purchase.id);
  if (await prisma.creditPurchase.count({ where: { organizerId, status: "PENDING", provider: "MULTICAIXA_EXPRESS" } })) {
    throw new UserError("Já existe um pedido à espera de confirmação na app Multicaixa Express. Confirme-o ou aguarde que expire.");
  }
  await prisma.creditPurchase.updateMany({
    where: { organizerId, status: "PENDING" },
    data: { status: "FAILED", failureReason: "Substituído por uma nova tentativa", settledAt: new Date() },
  });

  const quote = quoteCredits(credits, creditPriceCents());
  const purchase = await prisma.creditPurchase.create({
    data: {
      organizerId,
      credits,
      unitCents: quote.unitCents,
      amountCents: quote.amountCents,
      paidById: userId,
      provider: provider.id,
      chargeCurrency: "AOA",
      chargeAmountCents: quote.amountCents,
    },
  });
  try {
    const started = await provider.start({
      paymentId: purchase.id,
      amountCents: quote.amountCents,
      currency: "AOA",
      description: `${credits} créditos Camps — ${organizer.name}`,
      mobile,
      appUrl: appUrl(),
    });
    await prisma.creditPurchase.update({
      where: { id: purchase.id },
      data: { providerRef: started.providerRef, chargeCurrency: started.chargeCurrency, chargeAmountCents: started.chargeAmountCents },
    });
    return { redirectUrl: started.redirectUrl };
  } catch (error) {
    const reason = error instanceof UserError ? error.message : "Falha ao contactar o provedor de pagamento";
    await settleCreditPurchase(purchase.id, { status: "FAILED", reason });
    if (error instanceof UserError) throw error;
    console.error(`Compra de créditos ${purchase.id} (${provider.id}) não arrancou`, error);
    throw new UserError("Não foi possível iniciar o pagamento. Tente novamente dentro de instantes.");
  }
}

const PROVIDER_LABEL = { MULTICAIXA_EXPRESS: "Multicaixa Express", PAYPAL: "PayPal", SIMULATOR: "Simulador" } as const;

/** Grava o desfecho uma única vez; se foi paga, soma os créditos e emite a fatura na mesma transação. */
async function settleCreditPurchase(purchaseId: string, outcome: Outcome) {
  if (outcome.status === "PENDING") return;
  const paid = await prisma.$transaction(async (tx) => {
    const { count: changed } = await tx.creditPurchase.updateMany({
      where: { id: purchaseId, status: "PENDING" },
      data: { status: outcome.status, failureReason: outcome.status === "FAILED" ? outcome.reason : null, settledAt: new Date() },
    });
    if (changed === 0 || outcome.status !== "SUCCEEDED") return null;
    const purchase = await tx.creditPurchase.findUniqueOrThrow({ where: { id: purchaseId } });
    const organizer = await tx.organizer.update({
      where: { id: purchase.organizerId },
      data: { credits: { increment: purchase.credits } },
      select: { credits: true },
    });
    await tx.creditTransaction.create({
      data: {
        organizerId: purchase.organizerId,
        kind: "PURCHASE",
        delta: purchase.credits,
        balance: organizer.credits,
        purchaseId: purchase.id,
        createdBy: purchase.paidById,
      },
    });
    await unlockWelcomeCredits(tx, purchase.organizerId, purchase.credits);
    const issued = await invoiceCredits(tx, {
      organizerId: purchase.organizerId,
      credits: purchase.credits,
      unitCents: purchase.unitCents,
      paidVia: `Pago por ${PROVIDER_LABEL[purchase.provider]}`,
    });
    return { issued, organizerId: purchase.organizerId };
  });
  if (!paid) return;
  await afterIssue(paid.issued);
  // Os atletas que estavam por cobrar gastam já os créditos novos.
  await settleDueCredits(paid.organizerId);
}

/** Pergunta ao provedor por uma compra pendente (no máximo uma vez a cada 3 s, salvo `force`). */
export async function refreshCreditPurchase(purchaseId: string, options: { force?: boolean } = {}) {
  const purchase = await prisma.creditPurchase.findUnique({ where: { id: purchaseId } });
  if (!purchase || purchase.status !== "PENDING" || !purchase.providerRef) return;
  const checks = await (await kv()).incr(`paycheck:${purchase.id}`, 3_000);
  if (checks > 1 && !options.force) return;
  try {
    await settleCreditPurchase(purchase.id, await providerFor(purchase.provider, PLATFORM).check(purchase.providerRef));
  } catch (error) {
    console.error(`Não foi possível consultar a compra de créditos ${purchase.id}`, error);
  }
}

/** Callback ou retorno do provedor: devolve a compra se for de créditos, senão null. */
export async function refreshCreditPurchaseByProviderRef(provider: "MULTICAIXA_EXPRESS" | "PAYPAL", providerRef: string) {
  const purchase = await prisma.creditPurchase.findUnique({ where: { provider_providerRef: { provider, providerRef } } });
  if (purchase) await refreshCreditPurchase(purchase.id);
  return purchase;
}

export async function abandonPayPalCreditPurchase(purchaseId: string) {
  await refreshCreditPurchase(purchaseId);
  await prisma.creditPurchase.updateMany({
    where: { id: purchaseId, provider: "PAYPAL", status: "PENDING" },
    data: { status: "FAILED", failureReason: "Pagamento cancelado no PayPal", settledAt: new Date() },
  });
  return prisma.creditPurchase.findUnique({ where: { id: purchaseId } });
}

export async function expireStaleCreditPurchase(purchaseId: string) {
  const purchase = await prisma.creditPurchase.findUnique({ where: { id: purchaseId }, select: { status: true } });
  if (purchase?.status !== "PENDING") return false;
  await settleCreditPurchase(purchaseId, { status: "FAILED", reason: "O pagamento expirou sem confirmação" });
  return true;
}

export async function simulateCreditPurchase(userId: string, purchaseId: string, approve: boolean) {
  if (!simulatorEnabled()) throw new UserError("O simulador de pagamentos está desligado");
  const purchase = await prisma.creditPurchase.findFirst({ where: { id: purchaseId, provider: "SIMULATOR" } });
  if (!purchase) throw new UserError("Pagamento não encontrado");
  await requireCreditsAccess(userId, purchase.organizerId);
  await settleCreditPurchase(purchase.id, approve ? { status: "SUCCEEDED" } : { status: "FAILED", reason: "Recusado no simulador" });
}

// ---------- Equipa da Camps ----------

/** Acerto manual do saldo (ofertas, correções), sempre com o motivo e no registo de atividade. */
export async function adjustCredits(staff: Staff, organizerId: string, rawDelta: string, rawNote: string) {
  if (!can(staff.role, "finance")) throw new UserError("O seu papel na equipa não permite fazer isto");
  const delta = Number(rawDelta.replace(/\s/g, ""));
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100_000) throw new UserError("Indique quantos créditos somar (ou tirar, com sinal menos)");
  const note = rawNote.trim();
  if (note.length < 5 || note.length > 300) throw new UserError("Indique o motivo do acerto");
  await prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ credits: number }[]>`
      UPDATE "Organizer" SET "credits" = "credits" + ${delta}
       WHERE "id" = ${organizerId} AND "credits" + ${delta} >= 0
      RETURNING "credits"`;
    if (!row) throw new UserError("O saldo não pode ficar negativo");
    await tx.creditTransaction.create({
      data: { organizerId, kind: "ADJUSTMENT", delta, balance: row.credits, note, createdBy: staff.email },
    });
  });
  await audit(staff, "credits.adjust", { type: "organizer", id: organizerId }, { delta, note });
  if (delta > 0) await settleDueCredits(organizerId);
}
