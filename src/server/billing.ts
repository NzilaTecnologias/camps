import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { computeStatement, normalizeAngolanIban, type Statement } from "@/lib/statement";
import { can } from "@/lib/admin-permissions";
import { rolesWith } from "@/lib/organizer-permissions";
import { audit, type Staff } from "./admin/session";
import { billingDetails, invoiceEventFee, listEventInvoices, type BillingDetailsInput } from "./invoicing";
import { memberOf } from "./manage";

// Faturação entre a Camps e os organizadores, ao estilo dos créditos do Smoothcomp: a Camps cobra
// uma taxa por atleta confirmado em cada evento. Como as inscrições pagas online entram na conta da
// Camps, a taxa é descontada delas e o resto é transferido (repasse) para o IBAN do organizador.

type Row = {
  id: string;
  name: string;
  slug: string;
  status: string;
  endsAt: Date;
  platformFeeCents: number;
  organizerId: string;
  organizerName: string;
  payoutHolder: string | null;
  payoutIban: string | null;
  collected: bigint | number | null;
  refunded: bigint | number | null;
  athletes: bigint | number | null;
  paidOut: bigint | number | null;
};

export type EventStatement = Statement & {
  event: { id: string; name: string; slug: string; status: string; endsAt: Date };
  organizer: { id: string; name: string; payoutHolder: string | null; payoutIban: string | null };
};

const MAX_QUEUE = 200;

/** Extratos calculados no Postgres numa só consulta: um evento, ou todos os que têm movimento. */
async function statements(filter: Prisma.Sql, limit = MAX_QUEUE): Promise<EventStatement[]> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT e.id, e.name, e.slug, e.status::text AS status, e."endsAt", e."platformFeeCents",
           o.id AS "organizerId", o.name AS "organizerName", o."payoutHolder", o."payoutIban",
           p.collected, p.refunded, a.athletes, po."paidOut"
      FROM "Event" e
      JOIN "Organizer" o ON o.id = e."organizerId"
      LEFT JOIN (
        SELECT r."eventId",
               SUM(pay."amountCents") FILTER (WHERE pay.status IN ('SUCCEEDED', 'REFUNDED')) AS collected,
               SUM(pay."amountCents") FILTER (WHERE pay.status = 'REFUNDED') AS refunded
          FROM "Payment" pay
          JOIN "Registration" r ON r.id = pay."registrationId"
         GROUP BY r."eventId"
      ) p ON p."eventId" = e.id
      LEFT JOIN (
        SELECT "eventId", COUNT(DISTINCT "athleteId") AS athletes
          FROM "Registration"
         WHERE "confirmedAt" IS NOT NULL
         GROUP BY "eventId"
      ) a ON a."eventId" = e.id
      LEFT JOIN (SELECT "eventId", SUM("amountCents") AS "paidOut" FROM "Payout" GROUP BY "eventId") po ON po."eventId" = e.id
     WHERE ${filter}
     ORDER BY e."endsAt" DESC
     LIMIT ${limit}`;

  return rows.map((row) => ({
    ...computeStatement({
      collectedCents: Number(row.collected ?? 0),
      refundedCents: Number(row.refunded ?? 0),
      athletes: Number(row.athletes ?? 0),
      feePerAthleteCents: row.platformFeeCents,
      paidOutCents: Number(row.paidOut ?? 0),
    }),
    event: { id: row.id, name: row.name, slug: row.slug, status: row.status, endsAt: row.endsAt },
    organizer: { id: row.organizerId, name: row.organizerName, payoutHolder: row.payoutHolder, payoutIban: row.payoutIban },
  }));
}

/** Extrato de um evento, só para quem pertence à organização. */
export async function getEventStatement(userId: string, eventId: string) {
  const event = await prisma.event.findFirst({ where: { id: eventId, ...memberOf(userId, "money") }, select: { id: true } });
  if (!event) return null;
  const [statement] = await statements(Prisma.sql`e.id = ${event.id}`, 1);
  const [payouts, invoices, billing] = await Promise.all([
    prisma.payout.findMany({ where: { eventId: event.id }, orderBy: { paidAt: "desc" } }),
    listEventInvoices(event.id),
    prisma.organizer.findUniqueOrThrow({
      where: { id: statement.organizer.id },
      select: { billingName: true, billingNif: true, billingAddress: true },
    }),
  ]);
  return { statement, payouts, invoices, billing };
}

/** Conta onde o organizador recebe os repasses. */
export async function updatePayoutDetails(userId: string, organizerId: string, holder: string, iban: string) {
  await requirePayoutAccess(userId, organizerId);
  const name = holder.trim();
  if (name.length < 3 || name.length > 120) throw new UserError("Indique o titular da conta");
  const normalized = normalizeAngolanIban(iban);
  if (!normalized) throw new UserError("IBAN inválido. Um IBAN angolano tem AO seguido de 23 dígitos.");
  await prisma.organizer.update({ where: { id: organizerId }, data: { payoutHolder: name, payoutIban: normalized } });
}

/** Repasses e faturas só para a equipa com a permissão de finanças (área de administração). */
function requireFinance(staff: Staff) {
  if (!can(staff.role, "finance")) throw new UserError("O seu papel na equipa não permite fazer isto");
}

/** Fila de repasses: eventos com inscrições confirmadas, dinheiro cobrado ou repasses feitos. */
export async function listPayoutQueue(staff: Staff) {
  requireFinance(staff);
  return statements(Prisma.sql`(p.collected > 0 OR a.athletes > 0 OR po."paidOut" > 0)`);
}

/** Regista uma transferência feita para o organizador. Não pode passar do saldo em dívida. */
export async function recordPayout(staff: Staff, eventId: string, amount: string, reference: string) {
  requireFinance(staff);
  const [statement] = await statements(Prisma.sql`e.id = ${eventId}`, 1);
  if (!statement) throw new UserError("Evento não encontrado");
  const amountCents = Math.round(Number(amount.replace(/\s/g, "").replace(",", ".")) * 100);
  if (!(amountCents > 0)) throw new UserError("Indique o valor transferido");
  if (amountCents > statement.balanceCents) throw new UserError("O valor passa do saldo a transferir a este organizador");
  const ref = reference.trim();
  if (ref.length < 3 || ref.length > 80) throw new UserError("Indique a referência da transferência");
  if (!statement.organizer.payoutIban) throw new UserError("O organizador ainda não indicou o IBAN");
  await prisma.payout.create({ data: { eventId, amountCents, reference: ref, recordedBy: staff.email } });
  await audit(staff, "payout.record", { type: "event", id: eventId }, { amountCents, reference: ref });
  // A taxa dos atletas confirmados até agora sai faturada com o repasse.
  await invoiceEventFee(eventId);
}

/** O administrador fatura a taxa sem repasse (ex.: evento só com inscrições pagas em mão). */
export async function invoiceEventFeeNow(staff: Staff, eventId: string): Promise<boolean> {
  requireFinance(staff);
  const invoiceId = await invoiceEventFee(eventId);
  if (invoiceId) await audit(staff, "invoice.fee", { type: "invoice", id: invoiceId }, { eventId });
  return invoiceId !== null;
}

/** Nome, NIF e morada da organização para as faturas da taxa. */
export async function updateOrganizerBilling(userId: string, organizerId: string, input: BillingDetailsInput) {
  await requirePayoutAccess(userId, organizerId);
  await prisma.organizer.update({ where: { id: organizerId }, data: billingDetails(input) });
}

/** O IBAN e os dados de faturação só os muda o dono da organização. */
async function requirePayoutAccess(userId: string, organizerId: string) {
  const membership = await prisma.organizerMember.findFirst({
    where: { organizerId, userId, role: { in: rolesWith("payout") } },
  });
  if (!membership) throw new UserError("Só o dono da organização pode mudar a conta e os dados de faturação");
}
