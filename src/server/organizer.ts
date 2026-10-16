import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { UTC_OFFSET } from "@/lib/format";
import { parseLatLng } from "@/lib/geo";
import { SPORT_NAMES } from "@/lib/sports";
import { createBracket } from "./brackets";
import { memberOf } from "./manage";
import { refreshPayment } from "./registrations";
import { refreshRefund } from "./refunds";

// Consultas e ações das secções do painel de um evento. Tudo passa por memberOf:
// só quem pertence à organização do evento vê ou mexe.

/** Cabeçalho e menu do painel do evento; partilhado pelo layout e pelas páginas no mesmo pedido. */
export const getEventWorkspace = cache(async (userId: string, eventId: string) => {
  return prisma.event.findFirst({
    where: { id: eventId, ...memberOf(userId) },
    include: { organizer: { select: { name: true } } },
  });
});

export type EventWorkspace = NonNullable<Awaited<ReturnType<typeof getEventWorkspace>>>;

export async function getEventOverview(userId: string, eventId: string) {
  const where = { eventId, event: memberOf(userId) };
  const [byStatus, revenue, refunded, divisions, brackets, weighed, mats, coupons, recent] = await Promise.all([
    prisma.registration.groupBy({ by: ["status"], where, _count: true }),
    prisma.payment.aggregate({
      where: { registration: where, status: { in: ["SUCCEEDED", "REFUNDED"] } },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({ where: { registration: where, status: "REFUNDED" }, _sum: { amountCents: true } }),
    prisma.division.count({ where }),
    prisma.bracket.count({ where: { division: where } }),
    prisma.weighIn.count({ where: { registration: { ...where, status: "PAID" } } }),
    prisma.mat.findMany({ where, select: { isLive: true, currentMatchId: true } }),
    prisma.coupon.count({ where: { ...where, active: true } }),
    prisma.registration.findMany({
      where: { ...where, status: { not: "CANCELLED" } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        athlete: { select: { firstName: true, lastName: true, academy: { select: { name: true } } } },
        division: { select: { name: true } },
      },
    }),
  ]);
  const countOf = (status: string) => byStatus.find((row) => row.status === status)?._count ?? 0;
  const grossCents = revenue._sum.amountCents ?? 0;
  const refundedCents = refunded._sum.amountCents ?? 0;
  return {
    paid: countOf("PAID"),
    incomplete: countOf("INCOMPLETE"),
    cancelled: countOf("CANCELLED"),
    netCents: grossCents - refundedCents,
    refundedCents,
    divisions,
    brackets,
    weighed,
    mats: mats.length,
    liveMats: mats.filter((mat) => mat.isLive).length,
    busyMats: mats.filter((mat) => mat.currentMatchId).length,
    coupons,
    recent,
  };
}

export type EventSettingsInput = {
  name: string;
  sport: string;
  description: string;
  date: string;
  endDate: string;
  registrationOpensOn: string;
  registrationClosesOn: string;
  venue: string;
  city: string;
  latitude: string;
  longitude: string;
};

function parseDay(value: string, time: string, label: string): Date {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T${time}${UTC_OFFSET}`) : new Date(NaN);
  if (Number.isNaN(date.getTime())) throw new UserError(`Informe ${label}`);
  return date;
}

/** Edita a página pública do evento: nome, modalidade, datas, local e descrição. */
export async function updateEventSettings(userId: string, eventId: string, input: EventSettingsInput) {
  const event = await prisma.event.findFirst({ where: { id: eventId, ...memberOf(userId) } });
  if (!event) throw new UserError("Evento não encontrado");
  if (!input.name) throw new UserError("Informe o nome do evento");
  if (input.name.length > 120) throw new UserError("O nome pode ter no máximo 120 caracteres");
  if (input.description.length > 5000) throw new UserError("A descrição pode ter no máximo 5000 caracteres");
  if (!SPORT_NAMES.includes(input.sport)) throw new UserError("Escolha a modalidade do evento");
  const location = parseLatLng(input.latitude, input.longitude);
  if (location === "invalid") throw new UserError("Localização no mapa inválida");

  const startsAt = parseDay(input.date, "08:00:00", "a data do evento");
  const endsAt = parseDay(input.endDate || input.date, "20:00:00", "o último dia do evento");
  if (endsAt < startsAt) throw new UserError("O último dia não pode ser antes do primeiro");
  const registrationOpensAt = parseDay(input.registrationOpensOn, "00:00:00", "a abertura das inscrições");
  const registrationClosesAt = parseDay(input.registrationClosesOn, "23:59:59", "o fim das inscrições");
  if (registrationOpensAt > registrationClosesAt) throw new UserError("As inscrições têm de abrir antes de fechar");
  if (registrationClosesAt > endsAt) throw new UserError("As inscrições precisam fechar até ao último dia do evento");
  if (event.earlyDiscountEndsAt && event.earlyDiscountEndsAt > registrationClosesAt) {
    throw new UserError("O desconto antecipado acaba depois do fim das inscrições. Ajuste-o primeiro em Descontos.");
  }

  await prisma.event.update({
    where: { id: event.id },
    data: {
      name: input.name,
      sport: input.sport,
      description: input.description || null,
      venue: input.venue || null,
      city: input.city || null,
      latitude: location?.lat ?? null,
      longitude: location?.lng ?? null,
      startsAt,
      endsAt,
      registrationOpensAt,
      registrationClosesAt,
    },
  });
}

export async function cancelEvent(userId: string, eventId: string) {
  const event = await prisma.event.findFirst({ where: { id: eventId, ...memberOf(userId) } });
  if (!event) throw new UserError("Evento não encontrado");
  await prisma.event.update({ where: { id: event.id }, data: { status: "CANCELLED" } });
}

export function listDivisionsSummary(userId: string, eventId: string) {
  return prisma.division.findMany({
    where: { eventId, event: memberOf(userId) },
    orderBy: [{ gender: "asc" }, { belt: "asc" }, { maxWeightKg: "asc" }],
    include: {
      bracket: {
        select: {
          type: true,
          // Lutas a sério (sem as passagens diretas) e quantas já terminaram.
          _count: { select: { matches: { where: { status: { not: "BYE" } } }, placements: true } },
          matches: { where: { status: "FINISHED" }, select: { id: true } },
        },
      },
      _count: { select: { registrations: { where: { status: "PAID" } } } },
      registrations: {
        where: { status: "PAID" },
        select: { weighIn: { select: { passed: true } } },
      },
    },
  });
}

export type RegistrationFilters = { status?: string; divisionId?: string; q?: string };

const STATUSES = ["INCOMPLETE", "PAID", "CANCELLED"] as const;

export async function listEventRegistrations(userId: string, eventId: string, filters: RegistrationFilters) {
  const where: Prisma.RegistrationWhereInput = { eventId, event: memberOf(userId) };
  const status = STATUSES.find((value) => value === filters.status);
  if (status) where.status = status;
  if (filters.divisionId) where.divisionId = filters.divisionId;
  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { athlete: { firstName: { contains: q, mode: "insensitive" } } },
      { athlete: { lastName: { contains: q, mode: "insensitive" } } },
      { athlete: { academy: { name: { contains: q, mode: "insensitive" } } } },
      { registeredBy: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  // Põe em dia os pagamentos pendentes antes de mostrar a lista.
  const pending = await prisma.payment.findMany({
    where: { status: "PENDING", registration: where },
    select: { id: true },
    take: 20,
  });
  for (const payment of pending) await refreshPayment(payment.id);

  return prisma.registration.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      athlete: { select: { firstName: true, lastName: true, birthDate: true, academy: { select: { name: true } } } },
      division: { select: { id: true, name: true } },
      registeredBy: { select: { name: true, email: true } },
      coupon: { select: { code: true } },
      weighIn: { select: { weightKg: true, passed: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1, include: { refund: { select: { status: true } } } },
    },
  });
}

export async function listEventPayments(userId: string, eventId: string) {
  const where = { registration: { eventId, event: memberOf(userId) } };
  const pendingRefunds = await prisma.refund.findMany({ where: { status: "PENDING", payment: where }, select: { id: true } });
  for (const refund of pendingRefunds) await refreshRefund(refund.id);

  return prisma.payment.findMany({
    where: { ...where, status: { in: ["SUCCEEDED", "REFUNDED", "PENDING"] } },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      refund: { include: { requestedBy: { select: { name: true } } } },
      registration: {
        select: {
          id: true,
          discountCents: true,
          coupon: { select: { code: true } },
          athlete: { select: { firstName: true, lastName: true } },
          division: { select: { name: true } },
          registeredBy: { select: { email: true } },
        },
      },
    },
  });
}

/** Atletas confirmados de uma categoria (ou de todas), com a pesagem de cada um. */
export function listWeighIns(userId: string, eventId: string, divisionId?: string) {
  return prisma.division.findMany({
    where: { eventId, event: memberOf(userId), ...(divisionId ? { id: divisionId } : {}) },
    orderBy: [{ gender: "asc" }, { belt: "asc" }, { maxWeightKg: "asc" }],
    select: {
      id: true,
      name: true,
      maxWeightKg: true,
      bracket: { select: { id: true } },
      registrations: {
        where: { status: "PAID" },
        orderBy: [{ athlete: { firstName: "asc" } }, { athlete: { lastName: "asc" } }],
        select: {
          id: true,
          athlete: { select: { firstName: true, lastName: true, academy: { select: { name: true } } } },
          weighIn: { select: { weightKg: true, passed: true, weighedAt: true } },
        },
      },
    },
  });
}

/**
 * Grava a pesagem de um atleta. Passa se estiver dentro do limite da categoria;
 * quem não passa fica fora da chave quando ela for gerada.
 */
export async function recordWeighIn(userId: string, registrationId: string, weight: string) {
  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, status: "PAID", event: memberOf(userId) },
    include: { division: { select: { maxWeightKg: true } } },
  });
  if (!registration) throw new UserError("Inscrição não encontrada");
  const weightKg = Number(weight.replace(",", "."));
  if (!(weightKg > 10 && weightKg < 400)) throw new UserError("Peso inválido");
  const limit = registration.division.maxWeightKg;
  const passed = limit === null || weightKg <= Number(limit);
  const data = { weightKg, passed, weighedAt: new Date() };
  await prisma.weighIn.upsert({
    where: { registrationId: registration.id },
    update: data,
    create: { ...data, registrationId: registration.id },
  });
  return { passed };
}

export async function clearWeighIn(userId: string, registrationId: string) {
  const registration = await prisma.registration.findFirst({ where: { id: registrationId, event: memberOf(userId) } });
  if (!registration) throw new UserError("Inscrição não encontrada");
  await prisma.weighIn.deleteMany({ where: { registrationId: registration.id } });
}

const fighter = {
  select: { athlete: { select: { firstName: true, lastName: true, academy: { select: { name: true } } } } },
} as const;

/** Mesa do placar: cada área com a luta atual e as lutas prontas para chamar. */
export async function getScoreboardDesk(userId: string, eventId: string) {
  const where = { eventId, event: memberOf(userId) };
  const [mats, ready] = await Promise.all([
    prisma.mat.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        currentMatch: {
          select: {
            id: true,
            redScore: true,
            blueScore: true,
            clockStartedAt: true,
            red: fighter,
            blue: fighter,
            bracket: { select: { division: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.match.findMany({
      where: { status: "READY", bracket: { division: where } },
      orderBy: [{ round: "asc" }, { position: "asc" }],
      take: 100,
      select: {
        id: true,
        round: true,
        red: fighter,
        blue: fighter,
        mat: { select: { name: true } },
        currentOnMat: { select: { name: true } },
        bracket: { select: { division: { select: { id: true, name: true } } } },
      },
    }),
  ]);
  return { mats, ready };
}

export function listStreams(userId: string, eventId: string) {
  return prisma.mat.findMany({
    where: { eventId, event: memberOf(userId) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { currentMatch: { select: { id: true, red: fighter, blue: fighter } } },
  });
}

/** Quantas inscrições há em cada estado, para os separadores da lista. */
export async function countRegistrationsByStatus(userId: string, eventId: string) {
  const rows = await prisma.registration.groupBy({
    by: ["status"],
    where: { eventId, event: memberOf(userId) },
    _count: true,
  });
  const counts = { ALL: 0, INCOMPLETE: 0, PAID: 0, CANCELLED: 0 };
  for (const row of rows) {
    counts[row.status] = row._count;
    counts.ALL += row._count;
  }
  return counts;
}

/**
 * Gera de uma vez as chaves das categorias que ainda não têm, quando há pelo menos dois
 * atletas que podem lutar (pagos e sem reprovação na pesagem). Devolve quantas gerou.
 */
export async function generateMissingBrackets(userId: string, eventId: string, type: string) {
  if (type !== "SINGLE_ELIMINATION" && type !== "ROUND_ROBIN") throw new UserError("Tipo de chave inválido");
  const divisions = await prisma.division.findMany({
    where: { eventId, event: memberOf(userId), bracket: { is: null } },
    select: {
      id: true,
      _count: {
        select: {
          registrations: {
            where: { status: "PAID", OR: [{ weighIn: { is: null } }, { weighIn: { is: { passed: true } } }] },
          },
        },
      },
    },
  });
  const ready = divisions.filter((division) => division._count.registrations >= 2);
  for (const division of ready) await createBracket(division.id, type);
  return { generated: ready.length, skipped: divisions.length - ready.length };
}
