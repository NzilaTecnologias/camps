import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { UTC_OFFSET } from "@/lib/format";
import { normalizeAngolanMobile } from "@/lib/phone";
import { computePrice } from "@/lib/pricing";
import { premiumActive } from "@/lib/federation-rules";
import { findUsableCoupon } from "./coupons";
import { chargeAthlete } from "./credits";
import { activeMembership } from "./memberships";
import { deliverEmail } from "./email";
import { kv } from "./kv";
import { registrationConfirmedEmail } from "./notifications";
import { accountPayee, appUrl, getProvider, payeeOf, paymentMethods, providerFor, simulatorEnabled, type Payee } from "./payments";
import type { Outcome } from "./payments/types";

// O dinheiro das inscrições vai direto para a conta de pagamentos da organização do evento
// (PaymentAccount); cada atleta confirmado gasta 1 crédito da organização (server/credits.ts).

const NO_PAYMENTS = "A organização ainda não ligou uma conta para receber os pagamentos";

const organizerAccount = (organizerId: string) => prisma.paymentAccount.findUnique({ where: { organizerId } });

type Window = { registrationOpensAt: Date; registrationClosesAt: Date };

/** Devolve o motivo pelo qual não dá para inscrever agora, ou null se as inscrições estão abertas. */
export function registrationClosedReason(event: Window, now = new Date()): string | null {
  if (now < event.registrationOpensAt) return "As inscrições ainda não abriram";
  if (now > event.registrationClosesAt) return "As inscrições estão encerradas";
  return null;
}

export async function getRegistrationContext(userId: string, eventSlug: string, divisionId: string) {
  const division = await prisma.division.findFirst({
    where: { id: divisionId, event: { slug: eventSlug, status: "PUBLISHED" } },
    include: {
      event: { include: { federation: { select: { id: true, name: true, slug: true, plan: true, planExpiresAt: true } } } },
      _count: { select: { registrations: { where: { status: "PAID" } } } },
    },
  });
  if (!division) return null;
  // A conta fica fora do que vai para as páginas: só serve para decidir como se paga.
  const payee = accountPayee(await organizerAccount(division.event.organizerId));
  const providers = paymentMethods(payee).map(({ id, label }) => ({ id, label }));

  const athletes = await prisma.athleteProfile.findMany({
    where: { userId, gender: division.gender },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    include: { registrations: { where: { divisionId, status: "PAID" }, select: { id: true } } },
  });

  const isFull = division.capacity !== null && division._count.registrations >= division.capacity;
  // Uma categoria paga precisa de um método para pagar à organização; as gratuitas não.
  const cannotPay = division.priceCents > 0 && providers.length === 0;
  return {
    division,
    athletes,
    payee,
    providers,
    closedReason:
      registrationClosedReason(division.event) ?? (isFull ? "Esta categoria está esgotada" : cannotPay ? NO_PAYMENTS : null),
  };
}

export type RegistrationInput = {
  eventSlug: string;
  divisionId: string;
  /** Vazio = criar um atleta novo com os campos abaixo. */
  athleteId: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  academyName: string;
  provider: string;
  mobile: string;
  /** Código de cupão escrito pelo atleta; vazio = sem cupão. */
  couponCode: string;
};

export type Started = { registrationId: string; redirectUrl?: string };

export async function startRegistration(userId: string, input: RegistrationInput): Promise<Started> {
  const context = await getRegistrationContext(userId, input.eventSlug, input.divisionId);
  if (!context) throw new UserError("Categoria não encontrada");
  if (context.closedReason) throw new UserError(context.closedReason);
  const { division } = context;

  const coupon = input.couponCode ? await findUsableCoupon(division.eventId, input.couponCode) : null;
  const price = computePrice(division.priceCents, division.event, coupon);
  const isFree = price.priceCents === 0;

  // Valida o método antes de gravar o que quer que seja.
  if (!isFree) requireProvider(context.payee, input.provider, input.mobile);

  // Evento que exige filiação (plano Premium da federação): o atleta tem de estar filiado no dia da prova.
  const federation = division.event.requiresMembership ? division.event.federation : null;
  const needsMembership = federation !== null && premiumActive(federation);
  if (needsMembership && !input.athleteId) {
    throw new UserError(`Este evento exige filiação ativa na ${federation.name}. Filie primeiro o atleta em /f/${federation.slug}/filiacao.`);
  }

  const athlete = input.athleteId
    ? await prisma.athleteProfile.findFirst({ where: { id: input.athleteId, userId, gender: division.gender } })
    : await createAthlete(userId, division, input);
  if (!athlete) throw new UserError("Atleta não encontrado");
  if (needsMembership && !(await activeMembership(athlete.id, federation.id, division.event.startsAt))) {
    throw new UserError(`Este evento exige filiação ativa na ${federation.name} no dia da prova. Filie o atleta em /f/${federation.slug}/filiacao.`);
  }

  // Idade de competição: a que o atleta completa no ano do evento.
  const age = division.event.startsAt.getUTCFullYear() - athlete.birthDate.getUTCFullYear();
  if ((division.minAge !== null && age < division.minAge) || (division.maxAge !== null && age > division.maxAge)) {
    throw new UserError("A idade do atleta não corresponde a esta categoria");
  }

  const key = { divisionId_athleteId: { divisionId: division.id, athleteId: athlete.id } };
  const existing = await prisma.registration.findUnique({ where: key });
  if (existing?.status === "PAID") throw new UserError("Este atleta já está inscrito nesta categoria");

  const data = {
    registeredById: userId,
    priceCents: price.priceCents,
    discountCents: price.discountCents,
    couponId: coupon?.id ?? null,
    status: isFree ? ("PAID" as const) : ("INCOMPLETE" as const),
    ...(isFree ? { confirmedAt: new Date() } : {}),
  };
  const registration = await prisma.registration.upsert({
    where: key,
    update: data,
    create: { ...data, eventId: division.eventId, divisionId: division.id, athleteId: athlete.id },
  });

  if (isFree) {
    const emailId = await prisma.$transaction(async (tx) => {
      await chargeAthlete(tx, registration.eventId, registration.athleteId);
      return registrationConfirmedEmail(tx, registration.id);
    });
    await deliverEmail(emailId);
    return { registrationId: registration.id };
  }
  return startPayment(userId, registration.id, input.provider, input.mobile);
}

async function createAthlete(
  userId: string,
  division: { gender: "MALE" | "FEMALE"; belt: string; event: { country: string } },
  input: RegistrationInput,
) {
  if (!input.firstName || !input.lastName) throw new UserError("Informe o nome e o apelido do atleta");
  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)
    ? new Date(`${input.birthDate}T12:00:00${UTC_OFFSET}`)
    : new Date(NaN);
  if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) {
    throw new UserError("Informe a data de nascimento do atleta");
  }

  const academy = input.academyName
    ? ((await prisma.academy.findFirst({ where: { name: { equals: input.academyName, mode: "insensitive" } } })) ??
      (await prisma.academy.create({ data: { name: input.academyName, country: division.event.country } })))
    : null;

  return prisma.athleteProfile.create({
    data: {
      userId,
      firstName: input.firstName,
      lastName: input.lastName,
      birthDate,
      gender: division.gender,
      country: division.event.country,
      belt: division.belt,
      academyId: academy?.id,
    },
  });
}

function requireProvider(payee: Payee, providerId: string, mobileInput: string) {
  const provider = getProvider(payee, providerId);
  if (!provider) throw new UserError(paymentMethods(payee).length === 0 ? NO_PAYMENTS : "Escolha um método de pagamento");
  const mobile = provider.id === "MULTICAIXA_EXPRESS" ? normalizeAngolanMobile(mobileInput) : null;
  if (provider.id === "MULTICAIXA_EXPRESS" && !mobile) {
    throw new UserError("Informe um número de telemóvel angolano válido (9 dígitos, a começar por 9)");
  }
  return { provider, mobile };
}

/** Abre um pagamento para uma inscrição ainda por pagar. */
export async function startPayment(
  userId: string,
  registrationId: string,
  providerId: string,
  mobileInput: string,
): Promise<Started> {
  const pending = await prisma.payment.findMany({
    where: { registrationId, status: "PENDING", registration: { registeredById: userId } },
  });
  for (const payment of pending) await refreshPayment(payment.id);

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, registeredById: userId },
    include: {
      athlete: true,
      division: { include: { event: true } },
      payments: { where: { status: "PENDING" } },
    },
  });
  if (!registration) throw new UserError("Inscrição não encontrada");
  const account = await organizerAccount(registration.division.event.organizerId);
  const { provider, mobile } = requireProvider(accountPayee(account), providerId, mobileInput);
  if (registration.status === "PAID") return { registrationId };
  const closedReason = registrationClosedReason(registration.division.event);
  if (closedReason) throw new UserError(closedReason);

  // Um pedido Multicaixa Express pendente ainda pode ser confirmado no telemóvel:
  // abrir outro por cima arriscava cobrar duas vezes. Uma ordem PayPal por aprovar
  // só é cobrada se a capturarmos, por isso pode ser abandonada sem risco.
  if (registration.payments.some((payment) => payment.provider === "MULTICAIXA_EXPRESS")) {
    throw new UserError(
      "Já existe um pedido à espera de confirmação na app Multicaixa Express. Confirme-o ou aguarde que expire.",
    );
  }
  await prisma.payment.updateMany({
    where: { registrationId, status: "PENDING" },
    data: { status: "FAILED", failureReason: "Substituído por uma nova tentativa", settledAt: new Date() },
  });

  const { event } = registration.division;
  const payment = await prisma.payment.create({
    data: {
      registrationId,
      provider: provider.id,
      amountCents: registration.priceCents,
      chargeCurrency: event.currency,
      chargeAmountCents: registration.priceCents,
      // A conta da organização onde o dinheiro vai cair (o simulador não cobra em conta nenhuma).
      accountId: provider.id === "SIMULATOR" ? null : (account?.id ?? null),
    },
  });

  try {
    const started = await provider.start({
      paymentId: payment.id,
      amountCents: registration.priceCents,
      currency: event.currency,
      description: `${event.name} — ${registration.athlete.firstName} ${registration.athlete.lastName}`,
      mobile,
      appUrl: appUrl(),
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerRef: started.providerRef,
        chargeCurrency: started.chargeCurrency,
        chargeAmountCents: started.chargeAmountCents,
      },
    });
    return { registrationId, redirectUrl: started.redirectUrl };
  } catch (error) {
    const reason = error instanceof UserError ? error.message : "Falha ao contactar o provedor de pagamento";
    await settle(payment.id, { status: "FAILED", reason });
    if (error instanceof UserError) throw error;
    console.error(`Pagamento ${payment.id} (${provider.id}) não arrancou`, error);
    throw new UserError("Não foi possível iniciar o pagamento. Tente novamente dentro de instantes.");
  }
}

/** Grava o desfecho de um pagamento uma única vez e, se foi pago, confirma a inscrição. */
async function settle(paymentId: string, outcome: Outcome) {
  if (outcome.status === "PENDING") return;
  const emailId = await prisma.$transaction(async (tx) => {
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: {
        status: outcome.status,
        failureReason: outcome.status === "FAILED" ? outcome.reason : null,
        settledAt: new Date(),
      },
    });
    if (count === 0 || outcome.status !== "SUCCEEDED") return null;
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const registration = await tx.registration.update({ where: { id: payment.registrationId }, data: { status: "PAID" } });
    // Só a primeira confirmação conta: é a partir dela que o atleta gasta o crédito da organização.
    await tx.registration.updateMany({
      where: { id: payment.registrationId, confirmedAt: null },
      data: { confirmedAt: new Date() },
    });
    await chargeAthlete(tx, registration.eventId, registration.athleteId);
    return registrationConfirmedEmail(tx, payment.registrationId, payment);
  });
  if (emailId) await deliverEmail(emailId);
}

/**
 * Pergunta ao provedor como está um pagamento pendente e acerta o nosso lado.
 * A página da inscrição, o callback e a tarefa de fundo podem pedir o mesmo pagamento ao mesmo
 * tempo: no máximo uma consulta ao provedor a cada 3 s por pagamento (a tarefa de fundo força).
 */
export async function refreshPayment(paymentId: string, options: { force?: boolean } = {}) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== "PENDING" || !payment.providerRef) return;
  const checks = await (await kv()).incr(`paycheck:${payment.id}`, 3_000);
  if (checks > 1 && !options.force) return;
  try {
    await settle(payment.id, await providerFor(payment.provider, await payeeOf(payment.accountId)).check(payment.providerRef));
  } catch (error) {
    // Fica pendente: a próxima consulta tenta outra vez.
    console.error(`Não foi possível consultar o pagamento ${payment.id}`, error);
  }
}

/** Dá como falhado um pagamento que continua pendente muito depois de o provedor o poder aceitar. */
export async function expireStalePayment(paymentId: string): Promise<boolean> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { status: true } });
  if (payment?.status !== "PENDING") return false;
  await settle(paymentId, { status: "FAILED", reason: "O pagamento expirou sem confirmação" });
  return true;
}

/** Callback do provedor: só diz qual transação mudou; o estado é confirmado junto do provedor. */
export async function refreshByProviderRef(provider: "MULTICAIXA_EXPRESS" | "PAYPAL", providerRef: string) {
  const payment = await prisma.payment.findUnique({ where: { provider_providerRef: { provider, providerRef } } });
  if (payment) await refreshPayment(payment.id);
  return payment;
}

/** O utilizador desistiu no PayPal: se a ordem não chegou a ser aprovada, o pagamento fica sem efeito. */
export async function abandonPayPalPayment(paymentId: string) {
  await refreshPayment(paymentId);
  await prisma.payment.updateMany({
    where: { id: paymentId, provider: "PAYPAL", status: "PENDING" },
    data: { status: "FAILED", failureReason: "Pagamento cancelado no PayPal", settledAt: new Date() },
  });
  return prisma.payment.findUnique({ where: { id: paymentId } });
}

export async function simulatePayment(userId: string, paymentId: string, approve: boolean) {
  if (!simulatorEnabled()) throw new UserError("O simulador de pagamentos está desligado");
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, provider: "SIMULATOR", registration: { registeredById: userId } },
    include: { registration: { select: { eventId: true } } },
  });
  if (!payment) throw new UserError("Pagamento não encontrado");
  await settle(
    payment.id,
    approve ? { status: "SUCCEEDED" } : { status: "FAILED", reason: "Recusado no simulador" },
  );
  return payment.registration.eventId;
}

const registrationSummary = {
  athlete: { select: { firstName: true, lastName: true } },
  division: { select: { id: true, name: true, event: true } },
} as const;

export function listMyRegistrations(userId: string) {
  return prisma.registration.findMany({
    where: { registeredById: userId, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    include: registrationSummary,
  });
}

export async function getMyRegistration(userId: string, registrationId: string) {
  const where = { id: registrationId, registeredById: userId };
  const pending = await prisma.payment.findMany({ where: { registration: where, status: "PENDING" } });
  for (const payment of pending) await refreshPayment(payment.id);

  const registration = await prisma.registration.findFirst({
    where,
    include: {
      ...registrationSummary,
      coupon: { select: { code: true } },
      payments: { orderBy: { createdAt: "desc" }, include: { refund: { select: { status: true, reason: true } } } },
    },
  });
  if (!registration) return null;
  return {
    registration,
    providers: paymentMethods(accountPayee(await organizerAccount(registration.division.event.organizerId))).map(({ id, label }) => ({
      id,
      label,
    })),
    closedReason: registrationClosedReason(registration.division.event),
  };
}
