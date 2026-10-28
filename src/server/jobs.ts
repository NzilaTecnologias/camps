import { prisma } from "@/lib/db";
import { queueAthleteNotices } from "./athlete-notices";
import { deliverPendingEmails } from "./email";
import { kv } from "./kv";
import { refreshRefund } from "./refunds";
import { refreshCommunityStats } from "./stats";
import { expireStaleCreditPurchase, refreshCreditPurchase } from "./credits";
import { expireStalePlanPayment, refreshPlanPayment } from "./federation-plan";
import { expireStaleMembershipPayment, refreshMembershipPayment, refreshMembershipRefund } from "./memberships";
import { expireStalePayment, refreshPayment } from "./registrations";

// Trabalho de fundo, fora dos pedidos dos utilizadores. Corre por um destes caminhos:
//  - JOBS_INTERVAL_SECONDS: cada servidor tenta de x em x segundos (instrumentation.ts);
//  - GET /api/cron/jobs com "Authorization: Bearer <CRON_SECRET>", para um agendador externo.
// Um bloqueio no kv (Redis, quando há vários servidores) garante que só um trabalha de cada vez.

const LOCK_KEY = "jobs:lock";
/** Se um servidor morrer a meio, o bloqueio solta-se sozinho ao fim deste tempo. */
const LOCK_TTL_MS = 5 * 60 * 1000;
const BATCH = 200;
const PROVIDER_CONCURRENCY = 5;
/** Pagamentos pendentes há mais do que isto já não podem ser confirmados no provedor. */
const PAYMENT_GIVE_UP_MS = 6 * 60 * 60 * 1000;
const STATS_EVERY_MS = 5 * 60 * 1000;

export type JobReport = {
  ran: boolean;
  payments: number;
  refunds: number;
  expired: number;
  stats: boolean;
  sessions: number;
  notices: number;
  emails: number;
  ms: number;
};

/** Corre `work` sobre a lista, no máximo `limit` de cada vez (as chamadas aos provedores são lentas). */
async function eachLimited<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await work(items[next++]);
    }),
  );
}

/** Pergunta aos provedores pelos pagamentos e reembolsos pendentes. */
export async function reconcilePending(now = new Date()) {
  const payments = await prisma.payment.findMany({
    where: { status: "PENDING", providerRef: { not: null }, createdAt: { lt: new Date(now.getTime() - 15_000) } },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: { id: true, createdAt: true },
  });
  let expired = 0;
  await eachLimited(payments, PROVIDER_CONCURRENCY, async (payment) => {
    await refreshPayment(payment.id, { force: true });
    if (now.getTime() - payment.createdAt.getTime() > PAYMENT_GIVE_UP_MS && (await expireStalePayment(payment.id))) {
      expired++;
    }
  });

  // Quotas de filiação das federações: mesmas regras.
  const membershipPayments = await prisma.membershipPayment.findMany({
    where: { status: "PENDING", providerRef: { not: null }, createdAt: { lt: new Date(now.getTime() - 15_000) } },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: { id: true, createdAt: true },
  });
  await eachLimited(membershipPayments, PROVIDER_CONCURRENCY, async (payment) => {
    await refreshMembershipPayment(payment.id, { force: true });
    if (now.getTime() - payment.createdAt.getTime() > PAYMENT_GIVE_UP_MS && (await expireStaleMembershipPayment(payment.id))) {
      expired++;
    }
  });

  // Assinaturas do Plano Federação: mesmas regras.
  const planPayments = await prisma.federationPlanPayment.findMany({
    where: { status: "PENDING", providerRef: { not: null }, createdAt: { lt: new Date(now.getTime() - 15_000) } },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: { id: true, createdAt: true },
  });
  await eachLimited(planPayments, PROVIDER_CONCURRENCY, async (payment) => {
    await refreshPlanPayment(payment.id, { force: true });
    if (now.getTime() - payment.createdAt.getTime() > PAYMENT_GIVE_UP_MS && (await expireStalePlanPayment(payment.id))) {
      expired++;
    }
  });

  // Compras de créditos: mesmas regras.
  const creditPurchases = await prisma.creditPurchase.findMany({
    where: { status: "PENDING", providerRef: { not: null }, createdAt: { lt: new Date(now.getTime() - 15_000) } },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: { id: true, createdAt: true },
  });
  await eachLimited(creditPurchases, PROVIDER_CONCURRENCY, async (purchase) => {
    await refreshCreditPurchase(purchase.id, { force: true });
    if (now.getTime() - purchase.createdAt.getTime() > PAYMENT_GIVE_UP_MS && (await expireStaleCreditPurchase(purchase.id))) {
      expired++;
    }
  });

  const refunds = await prisma.refund.findMany({
    where: { status: "PENDING", manual: false, providerRef: { not: null } },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: { id: true },
  });
  await eachLimited(refunds, PROVIDER_CONCURRENCY, (refund) => refreshRefund(refund.id));

  const membershipRefunds = await prisma.membershipRefund.findMany({
    where: { status: "PENDING", manual: false, providerRef: { not: null } },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: { id: true },
  });
  await eachLimited(membershipRefunds, PROVIDER_CONCURRENCY, (refund) => refreshMembershipRefund(refund.id));
  return { payments: payments.length + membershipPayments.length + planPayments.length + creditPurchases.length, refunds: refunds.length + membershipRefunds.length, expired };
}

/** Corre todo o trabalho de fundo, se nenhum outro servidor o estiver a fazer agora. */
export async function runJobs(options: { forceStats?: boolean } = {}): Promise<JobReport> {
  const started = Date.now();
  const report: JobReport = { ran: false, payments: 0, refunds: 0, expired: 0, stats: false, sessions: 0, notices: 0, emails: 0, ms: 0 };

  // O bloqueio não segura nenhuma ligação à base de dados: o primeiro a incrementar a chave fica
  // com o trabalho, os outros saem logo. (Um bloqueio dentro de uma transação aberta prenderia
  // uma ligação durante minutos e, num Postgres de uma transação de cada vez, tudo o resto.)
  const store = await kv();
  if ((await store.incr(LOCK_KEY, LOCK_TTL_MS)) !== 1) {
    report.ms = Date.now() - started;
    return report;
  }
  try {
    report.ran = true;
    Object.assign(report, await reconcilePending());

    if (options.forceStats || !(await store.get("jobs:stats-fresh"))) {
      await refreshCommunityStats();
      await store.set("jobs:stats-fresh", "1", STATS_EVERY_MS);
      report.stats = true;
    }

    const { count } = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    report.sessions = count;

    // Avisos aos atletas (lembrete, chave publicada, resultado) e depois a fila de e-mails: os que
    // acabaram de entrar, os que falharam e os que ficaram por enviar.
    report.notices = await queueAthleteNotices();
    report.emails = await deliverPendingEmails();
    // Links de acesso caducados há mais de um dia.
    await prisma.authToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  } finally {
    await store.del(LOCK_KEY);
  }

  report.ms = Date.now() - started;
  return report;
}
