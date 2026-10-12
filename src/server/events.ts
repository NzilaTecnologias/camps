import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export function listPublishedEvents() {
  return prisma.event.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { startsAt: "asc" },
    include: { organizer: { select: { name: true } }, _count: { select: { registrations: true } } },
  });
}

export function getPublishedEvent(slug: string) {
  return prisma.event.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      organizer: { select: { name: true } },
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
        include: { red: athleteSummary, blue: athleteSummary },
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

export type DivisionDetails = NonNullable<Awaited<ReturnType<typeof getDivision>>>;
export type BracketDetails = NonNullable<DivisionDetails["bracket"]>;
