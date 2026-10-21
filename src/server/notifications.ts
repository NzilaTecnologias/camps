import type { Prisma } from "@/generated/prisma/client";
import { renderEmail } from "@/lib/email-template";
import { formatDate, formatMoney } from "@/lib/format";
import { enqueueEmail } from "./email";
import { appUrl } from "./payments";

// E-mails que acompanham as inscrições e as filiações. Cada função corre dentro da transação que
// muda o estado (o e-mail só fica na fila se a mudança for gravada) e devolve o id na fila, para
// quem chama o tentar enviar logo depois de a transação terminar.

type Tx = Prisma.TransactionClient;

const PROVIDER_LABEL = { MULTICAIXA_EXPRESS: "Multicaixa Express", PAYPAL: "PayPal", SIMULATOR: "Simulador" } as const;

function loadRegistration(tx: Tx, registrationId: string) {
  return tx.registration.findUniqueOrThrow({
    where: { id: registrationId },
    select: {
      id: true,
      priceCents: true,
      event: { select: { name: true, startsAt: true, venue: true, city: true, currency: true } },
      division: { select: { name: true } },
      athlete: { select: { firstName: true, lastName: true } },
      registeredBy: { select: { name: true, email: true } },
    },
  });
}

export async function registrationConfirmedEmail(
  tx: Tx,
  registrationId: string,
  payment?: { amountCents: number; provider: keyof typeof PROVIDER_LABEL },
): Promise<string> {
  const r = await loadRegistration(tx, registrationId);
  const place = [r.event.venue, r.event.city].filter(Boolean).join(", ");
  return enqueueEmail(
    tx,
    r.registeredBy.email,
    renderEmail({
      subject: `Inscrição confirmada: ${r.event.name}`,
      heading: "Inscrição confirmada",
      paragraphs: [
        `Olá ${r.registeredBy.name},`,
        `A inscrição de ${r.athlete.firstName} ${r.athlete.lastName} em ${r.event.name} está confirmada. Até ao tatami!`,
      ],
      rows: [
        ["Atleta", `${r.athlete.firstName} ${r.athlete.lastName}`],
        ["Categoria", r.division.name],
        ["Data", formatDate(r.event.startsAt)],
        ...(place ? ([["Local", place]] as [string, string][]) : []),
        ["Valor", payment ? formatMoney(payment.amountCents, r.event.currency) : "Gratuita"],
        ...(payment ? ([["Pago com", PROVIDER_LABEL[payment.provider]]] as [string, string][]) : []),
      ],
      action: { label: "Ver a inscrição", url: `${appUrl()}/registrations/${r.id}` },
      footnote: "Guarde este e-mail como comprovativo. As chaves e os horários aparecem na página do evento quando forem publicados.",
    }),
  );
}

export async function registrationRefundedEmail(tx: Tx, registrationId: string, amountCents: number, manual: boolean): Promise<string> {
  const r = await loadRegistration(tx, registrationId);
  return enqueueEmail(
    tx,
    r.registeredBy.email,
    renderEmail({
      subject: `Reembolso da inscrição: ${r.event.name}`,
      heading: "Inscrição reembolsada",
      paragraphs: [
        `Olá ${r.registeredBy.name},`,
        manual
          ? `O organizador de ${r.event.name} registou a devolução do valor da inscrição de ${r.athlete.firstName} ${r.athlete.lastName}, feita fora da plataforma. A inscrição foi cancelada.`
          : `O valor da inscrição de ${r.athlete.firstName} ${r.athlete.lastName} em ${r.event.name} foi devolvido para a conta de onde saiu o pagamento. A inscrição foi cancelada.`,
      ],
      rows: [
        ["Categoria", r.division.name],
        ["Valor devolvido", formatMoney(amountCents, r.event.currency)],
      ],
      action: { label: "Ver a inscrição", url: `${appUrl()}/registrations/${r.id}` },
      footnote: "Se tiver dúvidas sobre o reembolso, contacte o organizador do evento.",
    }),
  );
}

async function loadMembership(tx: Tx, membershipId: string) {
  const membership = await tx.membership.findUniqueOrThrow({
    where: { id: membershipId },
    select: {
      id: true,
      boughtById: true,
      validUntil: true,
      federation: { select: { name: true } },
      plan: { select: { name: true } },
      athlete: { select: { firstName: true, lastName: true } },
    },
  });
  const buyer = await tx.user.findUniqueOrThrow({ where: { id: membership.boughtById }, select: { name: true, email: true } });
  return { ...membership, buyer };
}

export async function membershipActiveEmail(tx: Tx, membershipId: string, amountCents: number): Promise<string> {
  const m = await loadMembership(tx, membershipId);
  return enqueueEmail(
    tx,
    m.buyer.email,
    renderEmail({
      subject: `Filiação ativa: ${m.federation.name}`,
      heading: "Filiação ativa",
      paragraphs: [
        `Olá ${m.buyer.name},`,
        `A quota de ${m.athlete.firstName} ${m.athlete.lastName} na ${m.federation.name} foi paga e a filiação já está ativa.`,
      ],
      rows: [
        ["Atleta", `${m.athlete.firstName} ${m.athlete.lastName}`],
        ["Plano", m.plan.name],
        ["Quota", formatMoney(amountCents, "AOA")],
        ...(m.validUntil ? ([["Válida até", formatDate(m.validUntil)]] as [string, string][]) : []),
      ],
      action: { label: "Ver a filiação", url: `${appUrl()}/memberships/${m.id}` },
      footnote: "Guarde este e-mail como comprovativo do pagamento da quota.",
    }),
  );
}

export async function membershipRefundedEmail(tx: Tx, membershipId: string, amountCents: number, manual: boolean): Promise<string> {
  const m = await loadMembership(tx, membershipId);
  return enqueueEmail(
    tx,
    m.buyer.email,
    renderEmail({
      subject: `Reembolso da quota: ${m.federation.name}`,
      heading: "Quota reembolsada",
      paragraphs: [
        `Olá ${m.buyer.name},`,
        manual
          ? `A ${m.federation.name} registou a devolução da quota de ${m.athlete.firstName} ${m.athlete.lastName}, feita fora da plataforma. A filiação foi cancelada.`
          : `A quota de ${m.athlete.firstName} ${m.athlete.lastName} na ${m.federation.name} foi devolvida para a conta de onde saiu o pagamento. A filiação foi cancelada.`,
      ],
      rows: [
        ["Plano", m.plan.name],
        ["Valor devolvido", formatMoney(amountCents, "AOA")],
      ],
      action: { label: "Ver a filiação", url: `${appUrl()}/memberships/${m.id}` },
      footnote: "Se tiver dúvidas sobre o reembolso, contacte a federação.",
    }),
  );
}
