import type { FederationPlan, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { renderEmail } from "@/lib/email-template";
import { UserError } from "@/lib/errors";
import { PLAN_LABEL } from "@/lib/federation-rules";
import { formatMoney } from "@/lib/format";
import { invoiceNumber, invoiceTotals, line, normalizeNif, type InvoiceLine } from "@/lib/invoice";
import { rolesWith } from "@/lib/organizer-permissions";
import { deliverEmail, enqueueEmail } from "./email";
import { appUrl } from "./payments";

// Faturas da Camps aos organizadores (taxa por atleta) e às federações (Plano Federação).
//
// Em Angola, as faturas têm de sair de um programa de faturação certificado pela AGT. Até haver
// um ligado, a Camps emite aqui documentos internos com numeração sequencial (sem falhas, por
// série e ano), que servem de comprovativo ao cliente e de base para o lançamento no programa
// certificado; a página da fatura di-lo claramente. Para ligar o programa certificado:
// acrescentar a CERTIFIED_PROVIDERS um objeto com `issue`, que recebe a fatura e devolve o
// número oficial e o PDF, e definir INVOICING_PROVIDER com o seu id.

type Tx = Prisma.TransactionClient;

type CertifiedProvider = {
  id: string;
  issue(invoice: { id: string; series: string; number: number; customerNif: string | null; lines: InvoiceLine[]; totalCents: number }): Promise<{ externalNumber: string; pdfUrl?: string }>;
};

const CERTIFIED_PROVIDERS: Record<string, CertifiedProvider> = {};

function certifiedProvider(): CertifiedProvider | null {
  const id = process.env.INVOICING_PROVIDER;
  return id ? (CERTIFIED_PROVIDERS[id] ?? null) : null;
}

/** IVA em pontos base (INVOICE_VAT_PERCENT, por omissão 14 %, a taxa geral em Angola). */
export function vatRateBp(): number {
  const percent = Number(process.env.INVOICE_VAT_PERCENT);
  return Math.round((Number.isFinite(percent) && percent >= 0 && process.env.INVOICE_VAT_PERCENT ? percent : 14) * 100);
}

function seriesFor(date: Date): string {
  const prefix = (process.env.INVOICE_SERIES_PREFIX || "CAMPS").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return `${prefix}${date.getUTCFullYear()}`;
}

/** Próximo número da série, atómico mesmo com vários servidores (a linha fica trancada até ao fim da transação). */
async function nextNumber(tx: Tx, series: string): Promise<number> {
  const [row] = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "InvoiceSeries" (series, last) VALUES (${series}, 1)
    ON CONFLICT (series) DO UPDATE SET last = "InvoiceSeries".last + 1
    RETURNING last`;
  return row.last;
}

type Customer = { name: string; nif: string | null; address: string | null; email: string };

type Draft = {
  kind: "PLATFORM_FEE" | "FEDERATION_PLAN";
  customer: Customer;
  organizerId?: string;
  eventId?: string;
  federationId?: string;
  lines: InvoiceLine[];
  /** Como foi paga, para o e-mail e a página (ex.: "Descontada no repasse do evento"). */
  paidVia: string;
};

/** Emite a fatura dentro da transação de quem a origina e põe o e-mail ao cliente na fila. */
async function issueInvoice(tx: Tx, draft: Draft): Promise<{ invoiceId: string; emailId: string }> {
  const now = new Date();
  const series = seriesFor(now);
  const number = await nextNumber(tx, series);
  const rate = vatRateBp();
  const totals = invoiceTotals(draft.lines, rate);
  const invoice = await tx.invoice.create({
    data: {
      series,
      number,
      kind: draft.kind,
      issuedAt: now,
      customerName: draft.customer.name,
      customerNif: draft.customer.nif,
      customerAddress: draft.customer.address,
      customerEmail: draft.customer.email,
      organizerId: draft.organizerId,
      eventId: draft.eventId,
      federationId: draft.federationId,
      lines: draft.lines,
      netCents: totals.netCents,
      vatRateBp: rate,
      vatCents: totals.vatCents,
      totalCents: totals.totalCents,
    },
  });
  const emailId = await enqueueEmail(
    tx,
    draft.customer.email,
    renderEmail({
      subject: `Fatura ${invoiceNumber(series, number)} da Camps`,
      heading: `Fatura ${invoiceNumber(series, number)}`,
      paragraphs: [`Olá,`, `Segue a fatura da Camps para ${draft.customer.name}.`],
      rows: [
        ...draft.lines.map((item): [string, string] => [item.description, formatMoney(item.totalCents, "AOA")]),
        ["Total (IVA incluído)", formatMoney(totals.totalCents, "AOA")],
        ["Pagamento", draft.paidVia],
      ],
      action: { label: "Ver a fatura", url: `${appUrl()}/invoices/${invoice.id}` },
      footnote: "Pode imprimir a fatura ou guardá-la em PDF a partir da página.",
    }),
  );
  return { invoiceId: invoice.id, emailId };
}

/** Pede o número oficial ao programa certificado, se houver um ligado. Nunca lança. */
async function certify(invoiceId: string) {
  const provider = certifiedProvider();
  if (!provider) return;
  try {
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const result = await provider.issue({ ...invoice, lines: invoice.lines as InvoiceLine[] });
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { provider: provider.id, certified: true, externalNumber: result.externalNumber, pdfUrl: result.pdfUrl },
    });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "fatura não certificada", invoiceId, error: String(error) }));
  }
}

/** Depois de a transação gravar: certificar e enviar o e-mail. */
export async function afterIssue(issued: { invoiceId: string; emailId: string } | null) {
  if (!issued) return;
  await certify(issued.invoiceId);
  await deliverEmail(issued.emailId);
}

async function organizerCustomer(tx: Tx, organizerId: string): Promise<Customer> {
  const organizer = await tx.organizer.findUniqueOrThrow({
    where: { id: organizerId },
    select: {
      name: true,
      billingName: true,
      billingNif: true,
      billingAddress: true,
      members: { where: { role: "OWNER" }, take: 1, select: { user: { select: { email: true } } } },
    },
  });
  const email = organizer.members[0]?.user.email;
  if (!email) throw new UserError("A organização não tem dono com e-mail para receber a fatura");
  return { name: organizer.billingName ?? organizer.name, nif: organizer.billingNif, address: organizer.billingAddress, email };
}

async function federationCustomer(tx: Tx, federationId: string): Promise<Customer> {
  const federation = await tx.federation.findUniqueOrThrow({
    where: { id: federationId },
    select: {
      name: true,
      billingName: true,
      billingNif: true,
      billingAddress: true,
      members: { take: 1, orderBy: { createdAt: "asc" }, select: { user: { select: { email: true } } } },
    },
  });
  const email = federation.members[0]?.user.email;
  if (!email) throw new UserError("A federação não tem gestor com e-mail para receber a fatura");
  return { name: federation.billingName ?? federation.name, nif: federation.billingNif, address: federation.billingAddress, email };
}

/**
 * Fatura a taxa dos atletas confirmados de um evento que ainda não foram faturados. Corre a cada
 * repasse (e a pedido do administrador), por isso um evento pode ter várias faturas, cada uma com
 * os atletas confirmados desde a anterior. Devolve null se não houver nada por faturar.
 */
export async function invoiceEventFee(eventId: string): Promise<string | null> {
  const issued = await prisma.$transaction(async (tx) => {
    const event = await tx.event.findUniqueOrThrow({
      where: { id: eventId },
      select: { id: true, name: true, organizerId: true, platformFeeCents: true },
    });
    if (event.platformFeeCents <= 0) return null;
    // Trancar as faturas deste evento: dois repasses ao mesmo tempo não faturam os mesmos atletas.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice-fee:${event.id}`}))`;
    const [{ athletes }] = await tx.$queryRaw<{ athletes: bigint }[]>`
      SELECT COUNT(DISTINCT "athleteId") AS athletes FROM "Registration"
       WHERE "eventId" = ${event.id} AND "confirmedAt" IS NOT NULL`;
    const previous = await tx.invoice.findMany({ where: { eventId: event.id, kind: "PLATFORM_FEE" }, select: { lines: true } });
    const invoiced = previous.flatMap((invoice) => invoice.lines as InvoiceLine[]).reduce((sum, item) => sum + item.quantity, 0);
    const pending = Number(athletes) - invoiced;
    if (pending <= 0) return null;
    return issueInvoice(tx, {
      kind: "PLATFORM_FEE",
      customer: await organizerCustomer(tx, event.organizerId),
      organizerId: event.organizerId,
      eventId: event.id,
      lines: [line(`Taxa de serviço Camps — ${event.name} (atletas confirmados)`, pending, event.platformFeeCents)],
      paidVia: "Descontada do saldo das inscrições no repasse do evento",
    });
  });
  await afterIssue(issued);
  return issued?.invoiceId ?? null;
}

/** Fatura de um ano (ou `months`) do Plano Federação, dentro da transação que o ativa. */
export function invoiceFederationPlan(
  tx: Tx,
  input: { federationId: string; plan: FederationPlan; months: number; amountCents: number; paidVia: string },
) {
  return federationCustomer(tx, input.federationId).then((customer) =>
    issueInvoice(tx, {
      kind: "FEDERATION_PLAN",
      customer,
      federationId: input.federationId,
      lines: [line(`Plano Federação ${PLAN_LABEL[input.plan]} — ${input.months} meses`, 1, input.amountCents)],
      paidVia: input.paidVia,
    }),
  );
}

// ---------- Leituras ----------

/** A fatura, para quem gere a organização ou a federação cliente (a equipa vê-as na administração). */
export async function getInvoiceFor(user: { id: string; email: string }, invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return null;
  if (invoice.organizerId) {
    const member = await prisma.organizerMember.count({
      where: { organizerId: invoice.organizerId, userId: user.id, role: { in: rolesWith("money") } },
    });
    if (member) return invoice;
  }
  if (invoice.federationId) {
    const member = await prisma.federationMember.count({ where: { federationId: invoice.federationId, userId: user.id } });
    if (member) return invoice;
  }
  return null;
}

export function listEventInvoices(eventId: string) {
  return prisma.invoice.findMany({ where: { eventId }, orderBy: { issuedAt: "desc" } });
}

export function listFederationInvoices(federationId: string) {
  return prisma.invoice.findMany({ where: { federationId }, orderBy: { issuedAt: "desc" } });
}

export type BillingDetailsInput = { name: string; nif: string; address: string };

/** Valida os dados de faturação (nome, NIF e morada) de uma organização ou federação. */
export function billingDetails(input: BillingDetailsInput) {
  const name = input.name.trim();
  const address = input.address.trim();
  if (name.length < 3 || name.length > 160) throw new UserError("Indique o nome para a fatura (denominação social)");
  const nif = normalizeNif(input.nif);
  if (!nif) throw new UserError("NIF inválido: 10 dígitos (empresa) ou o número do BI (pessoa)");
  if (address.length < 5 || address.length > 300) throw new UserError("Indique a morada para a fatura");
  return { billingName: name, billingNif: nif, billingAddress: address };
}
