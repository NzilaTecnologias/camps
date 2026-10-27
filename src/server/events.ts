import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { TAG } from "./cache-tags";

// Leituras públicas de eventos. Ficam em cache ("use cache") por poucos segundos em cada servidor:
// numa hora de ponta, milhares de visitas à mesma página custam uma consulta por intervalo.
// As ações do organizador apagam as etiquetas respetivas (cache-tags.ts).

const eventCardInclude = {
  organizer: { select: { name: true } },
  _count: {
    select: {
      divisions: true,
      registrations: { where: { status: "PAID" } },
      mats: { where: { isLive: true } },
    },
  },
} satisfies Prisma.EventInclude;

export type EventFilters = {
  when: "upcoming" | "past";
  search?: string;
  sport?: string;
  city?: string;
  /** Eventos que decorrem, pelo menos em parte, entre estas datas. */
  from?: Date | null;
  to?: Date | null;
  /** recent: publicados há menos tempo primeiro (por omissão); date: pela data do evento. */
  sort?: "recent" | "date" | "popular";
};

export const EVENTS_PER_PAGE = 24;

function eventWhere(filters: EventFilters, now: Date): Prisma.EventWhereInput {
  const upcoming = filters.when === "upcoming";
  const terms = (filters.search ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 4);
  return {
    status: "PUBLISHED",
    // Um evento a decorrer hoje ainda conta como próximo.
    endsAt: upcoming ? { gte: now } : { lt: now },
    ...(filters.sport ? { sport: filters.sport } : {}),
    ...(filters.city ? { city: { equals: filters.city, mode: "insensitive" as const } } : {}),
    ...(filters.to ? { startsAt: { lte: filters.to } } : {}),
    AND: [
      ...(filters.from ? [{ endsAt: { gte: filters.from } }] : []),
      // "Contém" usa os índices trigram de nome e cidade (migração 20261016150000_scale).
      ...terms.map((term) => ({
        OR: [
          { name: { contains: term, mode: "insensitive" as const } },
          { city: { contains: term, mode: "insensitive" as const } },
          { venue: { contains: term, mode: "insensitive" as const } },
          { organizer: { name: { contains: term, mode: "insensitive" as const } } },
        ],
      })),
    ],
  };
}

/**
 * Uma página de eventos e o total que corresponde aos filtros. Por omissão, os publicados há
 * menos tempo primeiro. "Popular" usa as inscrições pagas pré-calculadas pela tarefa de fundo, em
 * vez de as contar em cada pedido.
 */
export async function listEvents(filters: EventFilters, options: { take?: number; page?: number } = {}) {
  "use cache";
  cacheLife("public");
  cacheTag(TAG.events);
  // A hora fica fixa na entrada da cache: um evento passa a "passado" no máximo um minuto depois.
  const now = new Date();
  const upcoming = filters.when === "upcoming";
  const take = options.take ?? EVENTS_PER_PAGE;
  const where = eventWhere(filters, now);
  const byDate = { startsAt: upcoming ? "asc" : "desc" } as const;
  const orderBy: Prisma.EventOrderByWithRelationInput[] =
    filters.sort === "popular"
      ? [{ paidRegistrations: "desc" }, byDate]
      : filters.sort === "date"
        ? [byDate]
        : [{ publishedAt: { sort: "desc", nulls: "last" } }, byDate];
  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy,
      take,
      skip: Math.max(0, (options.page ?? 1) - 1) * take,
      include: eventCardInclude,
    }),
    prisma.event.count({ where }),
  ]);
  return { events, total };
}

/** Próximos eventos publicados, do mais próximo para o mais distante. */
export async function listPublishedEvents(take: number) {
  return (await listEvents({ when: "upcoming", sort: "date" }, { take })).events;
}

/** Cidades com eventos publicados, para o filtro da lista. */
export async function listEventCities() {
  "use cache";
  cacheLife("public");
  cacheTag(TAG.events);
  const rows = await prisma.event.findMany({
    where: { status: "PUBLISHED", city: { not: null } },
    distinct: ["city"],
    select: { city: true },
    orderBy: { city: "asc" },
  });
  return rows.flatMap((row) => (row.city ? [row.city] : []));
}

export async function getPublishedEvent(slug: string) {
  "use cache";
  cacheLife("live");
  cacheTag(TAG.eventSlug(slug), TAG.events);
  const event = await prisma.event.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      organizer: { select: { name: true } },
      federation: { select: { name: true, slug: true, plan: true, planExpiresAt: true } },
      // Só as áreas com alguma coisa a acontecer: transmissão no ar ou luta no placar.
      mats: {
        where: { OR: [{ isLive: true }, { currentMatchId: { not: null } }] },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, streamUrl: true, isLive: true, currentMatchId: true },
      },
      divisions: {
        orderBy: { maxWeightKg: "asc" },
        include: {
          bracket: { select: { id: true } },
          _count: { select: { registrations: { where: { status: "PAID" } } } },
        },
      },
    },
  });
  if (!event) return null;
  cacheTag(TAG.event(event.id));
  // A cache só guarda dados simples: o Decimal do peso passa a texto.
  return {
    ...event,
    divisions: event.divisions.map((division) => ({ ...division, maxWeightKg: division.maxWeightKg?.toString() ?? null })),
  };
}

const athleteSummary = {
  select: {
    id: true,
    athlete: {
      select: { id: true, firstName: true, lastName: true, academy: { select: { name: true } } },
    },
  },
} satisfies Prisma.RegistrationDefaultArgs;

/** Tudo que as páginas de categoria (pública e do painel) precisam para mostrar chave, pódio e inscritos. */
export const divisionDetails = {
  event: {
    select: { id: true, name: true, slug: true, currency: true, registrationOpensAt: true, registrationClosesAt: true },
  },
  registrations: { where: { status: "PAID" }, orderBy: { createdAt: "asc" }, ...athleteSummary },
  bracket: {
    include: {
      matches: {
        orderBy: [{ round: "asc" }, { position: "asc" }],
        include: {
          red: athleteSummary,
          blue: athleteSummary,
          currentOnMat: { select: { id: true, name: true } },
          mat: { select: { id: true, name: true } },
        },
      },
      placements: { orderBy: { place: "asc" }, include: { registration: athleteSummary } },
    },
  },
} satisfies Prisma.DivisionInclude;

export async function getDivision(eventSlug: string, divisionId: string) {
  "use cache";
  cacheLife("live");
  cacheTag(TAG.eventSlug(eventSlug));
  const division = await prisma.division.findFirst({
    where: { id: divisionId, event: { slug: eventSlug, status: "PUBLISHED" } },
    include: divisionDetails,
  });
  if (!division) return null;
  cacheTag(TAG.event(division.eventId));
  return { ...division, maxWeightKg: division.maxWeightKg?.toString() ?? null };
}

export type PublishedEvent = Awaited<ReturnType<typeof listPublishedEvents>>[number];
export type DivisionDetails = NonNullable<Awaited<ReturnType<typeof getDivision>>>;
export type BracketDetails = NonNullable<DivisionDetails["bracket"]>;

const MAP_LIMIT = 500;

/** Só o necessário para os marcadores do mapa (até 500 eventos), com os mesmos filtros da lista. */
export async function listEventMapPoints(filters: EventFilters) {
  "use cache";
  cacheLife("public");
  cacheTag(TAG.events);
  const upcoming = filters.when === "upcoming";
  return prisma.event.findMany({
    where: eventWhere(filters, new Date()),
    orderBy: { startsAt: upcoming ? "asc" : "desc" },
    take: MAP_LIMIT,
    select: {
      id: true,
      slug: true,
      name: true,
      sport: true,
      city: true,
      startsAt: true,
      endsAt: true,
      latitude: true,
      longitude: true,
    },
  });
}
