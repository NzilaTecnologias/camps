import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { parseStreamUrl } from "@/lib/stream";
import { TAG } from "./cache-tags";

// Páginas públicas da comunidade. Só entra o que já é público nas chaves e nos pódios:
// atletas com inscrição paga num evento publicado. Datas de nascimento nunca saem daqui.

const publicRegistration = { status: "PAID", event: { status: "PUBLISHED" } } as const;

export type Medals = { gold: number; silver: number; bronze: number };

function tally(places: number[]): Medals {
  return {
    gold: places.filter((place) => place === 1).length,
    silver: places.filter((place) => place === 2).length,
    bronze: places.filter((place) => place === 3).length,
  };
}

export const totalMedals = (medals: Medals) => medals.gold + medals.silver + medals.bronze;

export const ACADEMIES_PER_PAGE = 48;

/**
 * Academias ordenadas por medalhas, uma página de cada vez. As medalhas e a posição (`rank`)
 * são pré-calculadas pela tarefa de fundo (jobs.ts); a posição é sempre a do ranking geral,
 * mesmo quando a pesquisa mostra só algumas.
 */
export async function listAcademies(search = "", page = 1) {
  "use cache";
  cacheLife("public");
  cacheTag(TAG.community);
  const terms = search.trim().split(/s+/).filter(Boolean).slice(0, 4);
  const where: Prisma.AcademyWhereInput = {
    rank: { not: null },
    AND: terms.map((term) => ({
      OR: [
        { name: { contains: term, mode: "insensitive" as const } },
        { affiliation: { name: { contains: term, mode: "insensitive" as const } } },
      ],
    })),
  };
  const [rows, total] = await Promise.all([
    prisma.academy.findMany({
      where,
      orderBy: { rank: "asc" },
      take: ACADEMIES_PER_PAGE,
      skip: Math.max(0, page - 1) * ACADEMIES_PER_PAGE,
      include: { affiliation: { select: { name: true } } },
    }),
    prisma.academy.count({ where }),
  ]);
  const academies = rows.map((academy) => ({
    id: academy.id,
    name: academy.name,
    country: academy.country,
    affiliation: academy.affiliation?.name ?? null,
    athletes: academy.athleteCount,
    medals: { gold: academy.gold, silver: academy.silver, bronze: academy.bronze },
    rank: academy.rank!,
  }));
  return { academies, total };
}

/** Atletas mostrados na página de uma academia (as maiores podem ter milhares). */
const ACADEMY_ATHLETES_SHOWN = 300;

export async function getAcademy(id: string) {
  "use cache";
  cacheLife("public");
  cacheTag(TAG.community);
  const academy = await prisma.academy.findUnique({
    where: { id },
    include: {
      affiliation: { select: { name: true } },
      athletes: {
        where: { registrations: { some: publicRegistration } },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        take: ACADEMY_ATHLETES_SHOWN,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          belt: true,
          registrations: { where: publicRegistration, select: { placement: { select: { place: true } } } },
        },
      },
    },
  });
  if (!academy || academy.athletes.length === 0) return null;
  const placesOf = (athlete: (typeof academy.athletes)[number]) =>
    athlete.registrations.flatMap((r) => (r.placement ? [r.placement.place] : []));
  return {
    name: academy.name,
    country: academy.country,
    // Total pré-calculado: a lista abaixo pode vir cortada nas academias maiores.
    athleteCount: Math.max(academy.athleteCount, academy.athletes.length),
    affiliation: academy.affiliation?.name ?? null,
    athletes: academy.athletes.map((athlete) => ({
      id: athlete.id,
      name: `${athlete.firstName} ${athlete.lastName}`,
      belt: athlete.belt,
      medals: tally(placesOf(athlete)),
    })),
    medals: tally(academy.athletes.flatMap(placesOf)),
  };
}

export async function listAthletes(search: string) {
  "use cache";
  cacheLife("public");
  cacheTag(TAG.community);
  const terms = search.trim().split(/\s+/).filter(Boolean).slice(0, 4);
  const athletes = await prisma.athleteProfile.findMany({
    where: {
      registrations: { some: publicRegistration },
      AND: terms.map((term) => ({
        OR: [
          { firstName: { contains: term, mode: "insensitive" as const } },
          { lastName: { contains: term, mode: "insensitive" as const } },
        ],
      })),
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 60,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      belt: true,
      academy: { select: { id: true, name: true } },
      registrations: { where: publicRegistration, select: { placement: { select: { place: true } } } },
    },
  });
  return athletes.map((athlete) => ({
    id: athlete.id,
    name: `${athlete.firstName} ${athlete.lastName}`,
    belt: athlete.belt,
    academy: athlete.academy,
    events: athlete.registrations.length,
    medals: tally(athlete.registrations.flatMap((r) => (r.placement ? [r.placement.place] : []))),
  }));
}

export async function getAthlete(id: string) {
  "use cache";
  cacheLife("public");
  cacheTag(TAG.community);
  const athlete = await prisma.athleteProfile.findFirst({
    where: { id, registrations: { some: publicRegistration } },
    select: {
      firstName: true,
      lastName: true,
      belt: true,
      country: true,
      academy: { select: { id: true, name: true } },
      registrations: {
        where: publicRegistration,
        orderBy: { event: { startsAt: "desc" } },
        select: {
          id: true,
          placement: { select: { place: true } },
          division: { select: { id: true, name: true } },
          event: { select: { name: true, slug: true, startsAt: true } },
          wonMatches: { where: { status: "FINISHED" }, select: { id: true } },
          redMatches: { where: { status: "FINISHED" }, select: { id: true } },
          blueMatches: { where: { status: "FINISHED" }, select: { id: true } },
        },
      },
    },
  });
  if (!athlete) return null;

  const history = athlete.registrations.map((registration) => {
    const fights = registration.redMatches.length + registration.blueMatches.length;
    const wins = registration.wonMatches.length;
    return {
      id: registration.id,
      event: registration.event,
      division: registration.division,
      place: registration.placement?.place ?? null,
      fights,
      wins,
    };
  });
  return {
    name: `${athlete.firstName} ${athlete.lastName}`,
    belt: athlete.belt,
    country: athlete.country,
    academy: athlete.academy,
    history,
    fights: history.reduce((sum, entry) => sum + entry.fights, 0),
    wins: history.reduce((sum, entry) => sum + entry.wins, 0),
    medals: tally(history.flatMap((entry) => (entry.place ? [entry.place] : []))),
  };
}

/** Eventos publicados com transmissão no ar ou com lutas no placar neste momento. */
export async function listLiveEvents() {
  "use cache";
  cacheLife("live");
  cacheTag(TAG.live);
  return prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      mats: { some: { OR: [{ isLive: true }, { currentMatchId: { not: null } }] } },
    },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      mats: {
        where: { OR: [{ isLive: true }, { currentMatchId: { not: null } }] },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, streamUrl: true, isLive: true, currentMatchId: true },
      },
    },
  });
}

const streamSelect = {
  id: true,
  name: true,
  streamUrl: true,
  event: { select: { id: true, name: true, slug: true, city: true, sport: true, imageKey: true } },
  currentMatch: {
    select: {
      redScore: true,
      blueScore: true,
      red: { select: { athlete: { select: { firstName: true, lastName: true } } } },
      blue: { select: { athlete: { select: { firstName: true, lastName: true } } } },
      bracket: { select: { division: { select: { name: true } } } },
    },
  },
} satisfies Prisma.MatSelect;

type StreamRow = Prisma.MatGetPayload<{ select: typeof streamSelect }>;

function toStream(mat: StreamRow) {
  const embed = mat.streamUrl ? parseStreamUrl(mat.streamUrl) : null;
  if (!embed) return null;
  const match = mat.currentMatch;
  const fighter = (corner: { athlete: { firstName: string; lastName: string } } | null) =>
    corner ? `${corner.athlete.firstName} ${corner.athlete.lastName}` : "A definir";
  return {
    matId: mat.id,
    matName: mat.name,
    event: mat.event,
    ...embed,
    match: match
      ? {
          division: match.bracket.division.name,
          red: fighter(match.red),
          blue: fighter(match.blue),
          redScore: match.redScore,
          blueScore: match.blueScore,
        }
      : null,
  };
}

export type LiveStream = NonNullable<ReturnType<typeof toStream>>;

/** Transmissões no ar agora: áreas em direto, com endereço válido, de eventos publicados. */
export async function listLiveStreams(): Promise<LiveStream[]> {
  "use cache";
  cacheLife("live");
  cacheTag(TAG.live);
  const mats = await prisma.mat.findMany({
    where: { isLive: true, streamUrl: { not: null }, event: { status: "PUBLISHED" } },
    orderBy: [{ event: { startsAt: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    select: streamSelect,
  });
  return mats.flatMap((mat) => {
    const stream = toStream(mat);
    return stream ? [stream] : [];
  });
}

export async function getLiveStream(matId: string): Promise<LiveStream | null> {
  "use cache";
  cacheLife("live");
  cacheTag(TAG.live);
  const mat = await prisma.mat.findFirst({
    where: { id: matId, isLive: true, event: { status: "PUBLISHED" } },
    select: streamSelect,
  });
  return mat ? toStream(mat) : null;
}
