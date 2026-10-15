import type { Prisma } from "@/generated/prisma/client";
import { connection } from "next/server";
import { prisma } from "@/lib/db";

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
  sort?: "date" | "popular";
};

export async function listEvents(filters: EventFilters, take?: number) {
  // A lista depende da hora atual (próximos vs. passados): é calculada em cada pedido.
  await connection();
  const now = new Date();
  const upcoming = filters.when === "upcoming";
  const terms = (filters.search ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 4);

  return prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      // Um evento a decorrer hoje ainda conta como próximo.
      endsAt: upcoming ? { gte: now } : { lt: now },
      ...(filters.sport ? { sport: filters.sport } : {}),
      ...(filters.city ? { city: { equals: filters.city, mode: "insensitive" as const } } : {}),
      ...(filters.to ? { startsAt: { lte: filters.to } } : {}),
      AND: [
        ...(filters.from ? [{ endsAt: { gte: filters.from } }] : []),
        ...terms.map((term) => ({
          OR: [
            { name: { contains: term, mode: "insensitive" as const } },
            { city: { contains: term, mode: "insensitive" as const } },
            { venue: { contains: term, mode: "insensitive" as const } },
            { organizer: { name: { contains: term, mode: "insensitive" as const } } },
          ],
        })),
      ],
    },
    orderBy:
      filters.sort === "popular"
        ? [{ registrations: { _count: "desc" } }, { startsAt: upcoming ? "asc" : "desc" }]
        : { startsAt: upcoming ? "asc" : "desc" },
    take,
    include: eventCardInclude,
  });
}

/** Próximos eventos publicados, do mais próximo para o mais distante. */
export function listPublishedEvents(take?: number) {
  return listEvents({ when: "upcoming" }, take);
}

/** Cidades com eventos publicados, para o filtro da lista. */
export async function listEventCities() {
  const rows = await prisma.event.findMany({
    where: { status: "PUBLISHED", city: { not: null } },
    distinct: ["city"],
    select: { city: true },
    orderBy: { city: "asc" },
  });
  return rows.flatMap((row) => (row.city ? [row.city] : []));
}

export function getPublishedEvent(slug: string) {
  return prisma.event.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      organizer: { select: { name: true } },
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
}

const athleteSummary = {
  select: {
    id: true,
    athlete: {
      select: { firstName: true, lastName: true, academy: { select: { name: true } } },
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
        include: { red: athleteSummary, blue: athleteSummary, currentOnMat: { select: { id: true, name: true } } },
      },
      placements: { orderBy: { place: "asc" }, include: { registration: athleteSummary } },
    },
  },
} satisfies Prisma.DivisionInclude;

export function getDivision(eventSlug: string, divisionId: string) {
  return prisma.division.findFirst({
    where: { id: divisionId, event: { slug: eventSlug, status: "PUBLISHED" } },
    include: divisionDetails,
  });
}

export type PublishedEvent = Awaited<ReturnType<typeof listPublishedEvents>>[number];
export type DivisionDetails = NonNullable<Awaited<ReturnType<typeof getDivision>>>;
export type BracketDetails = NonNullable<DivisionDetails["bracket"]>;
