import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { parseDateTimeInput } from "@/lib/format";
import { balanceDivisions, buildSchedule } from "@/lib/schedule";
import { TAG } from "./cache-tags";
import { memberOf } from "./manage";

// Programação das lutas de um evento (regras em lib/schedule.ts). O organizador escolhe a área de
// cada categoria e a hora de início de cada área; "Gerar programação" põe as lutas por ordem e
// com hora prevista. Pode gerar-se de novo a qualquer momento: as lutas já disputadas ou no
// placar não mudam de área.

const fighter = {
  select: { athlete: { select: { firstName: true, lastName: true, academy: { select: { name: true } } } } },
} satisfies Prisma.RegistrationDefaultArgs;

const scheduledMatch = {
  id: true,
  key: true,
  round: true,
  status: true,
  sequence: true,
  scheduledAt: true,
  finishedAt: true,
  method: true,
  winnerId: true,
  redId: true,
  blueId: true,
  red: fighter,
  blue: fighter,
  currentOnMat: { select: { id: true } },
  bracket: { select: { type: true, division: { select: { id: true, name: true } } } },
} satisfies Prisma.MatchSelect;

const MIN_MINUTES = 2;
const MAX_MINUTES = 60;

/** Tudo o que a secção Programação do painel mostra. */
export async function getScheduleDesk(userId: string, eventId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, ...memberOf(userId) },
    select: {
      id: true,
      matchMinutes: true,
      startsAt: true,
      mats: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          startsAt: true,
          matches: {
            where: { sequence: { not: null } },
            orderBy: { sequence: "asc" },
            select: scheduledMatch,
          },
        },
      },
      divisions: {
        orderBy: [{ gender: "asc" }, { belt: "asc" }, { maxWeightKg: "asc" }],
        select: {
          id: true,
          name: true,
          matId: true,
          bracket: {
            select: { type: true, _count: { select: { matches: { where: { status: { not: "BYE" } } } } } },
          },
        },
      },
    },
  });
  return event;
}

async function requireManagedEvent(userId: string, eventId: string) {
  const event = await prisma.event.findFirst({ where: { id: eventId, ...memberOf(userId, "event") } });
  if (!event) throw new UserError("Evento não encontrado ou sem permissão");
  return event;
}

/** Minutos por luta e hora de início de cada área (campos `startsAt-<área>`). */
export async function updateScheduleSettings(userId: string, eventId: string, minutes: string, startsAt: Map<string, string>) {
  const event = await requireManagedEvent(userId, eventId);
  const matchMinutes = Number(minutes);
  if (!Number.isInteger(matchMinutes) || matchMinutes < MIN_MINUTES || matchMinutes > MAX_MINUTES) {
    throw new UserError(`Os minutos por luta vão de ${MIN_MINUTES} a ${MAX_MINUTES}`);
  }
  const mats = await prisma.mat.findMany({ where: { eventId: event.id }, select: { id: true, name: true } });
  const updates = mats.map((mat) => {
    const value = startsAt.get(mat.id) ?? "";
    const date = value ? parseDateTimeInput(value) : null;
    if (value && !date) throw new UserError(`Hora de início inválida na área ${mat.name}`);
    return prisma.mat.update({ where: { id: mat.id }, data: { startsAt: date } });
  });
  await prisma.$transaction([prisma.event.update({ where: { id: event.id }, data: { matchMinutes } }), ...updates]);
}

/** Área de cada categoria (campos `mat-<categoria>`; vazio = sem área). */
export async function assignDivisionMats(userId: string, eventId: string, choices: Map<string, string>) {
  const event = await requireManagedEvent(userId, eventId);
  const [mats, divisions] = await Promise.all([
    prisma.mat.findMany({ where: { eventId: event.id }, select: { id: true } }),
    prisma.division.findMany({ where: { eventId: event.id }, select: { id: true } }),
  ]);
  const matIds = new Set(mats.map((mat) => mat.id));
  const updates = divisions
    .filter((division) => choices.has(division.id))
    .map((division) => {
      const matId = choices.get(division.id) || null;
      if (matId && !matIds.has(matId)) throw new UserError("Área de luta não encontrada");
      return prisma.division.update({ where: { id: division.id }, data: { matId } });
    });
  await prisma.$transaction(updates);
}

/** Reparte pelas áreas as categorias que já têm chave, para acabarem mais ou menos à mesma hora. */
export async function balanceDivisionMats(userId: string, eventId: string) {
  const event = await requireManagedEvent(userId, eventId);
  const [mats, divisions] = await Promise.all([
    prisma.mat.findMany({ where: { eventId: event.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true } }),
    prisma.division.findMany({
      where: { eventId: event.id, bracket: { isNot: null } },
      select: { id: true, bracket: { select: { _count: { select: { matches: { where: { status: { not: "BYE" } } } } } } } },
    }),
  ]);
  if (mats.length === 0) throw new UserError("Crie primeiro as áreas de luta, em Placar e áreas");
  if (divisions.length === 0) throw new UserError("Gere primeiro as chaves das categorias");
  const assignment = balanceDivisions(
    mats.map((mat) => mat.id),
    divisions.map((division) => ({ id: division.id, matches: division.bracket?._count.matches ?? 0 })),
  );
  await prisma.$transaction(
    [...assignment].map(([divisionId, matId]) => prisma.division.update({ where: { id: divisionId }, data: { matId } })),
  );
}

/**
 * Gera a programação: ordem e hora prevista de cada luta, área a área. As lutas disputadas ou
 * no placar mantêm-se; as de categorias sem área saem da programação. Devolve quantas lutas
 * ficaram programadas.
 */
export async function generateSchedule(userId: string, eventId: string): Promise<number> {
  const event = await requireManagedEvent(userId, eventId);
  const [mats, divisions] = await Promise.all([
    prisma.mat.findMany({ where: { eventId: event.id }, select: { id: true, startsAt: true } }),
    prisma.division.findMany({
      where: { eventId: event.id, bracket: { isNot: null } },
      orderBy: [{ gender: "asc" }, { belt: "asc" }, { maxWeightKg: "asc" }],
      select: {
        id: true,
        matId: true,
        bracket: {
          select: {
            type: true,
            matches: {
              select: { id: true, key: true, round: true, position: true, status: true, nextKey: true, currentOnMat: { select: { id: true } } },
            },
          },
        },
      },
    }),
  ]);
  if (!divisions.some((division) => division.matId)) {
    throw new UserError("Escolha a área de pelo menos uma categoria com chave");
  }

  const slots = buildSchedule(
    // Sem hora própria, a área começa à hora de início do evento.
    mats.map((mat) => ({ id: mat.id, startsAt: mat.startsAt ?? event.startsAt })),
    divisions.map((division) => ({
      id: division.id,
      matId: division.matId,
      bracketType: division.bracket!.type,
      matches: division.bracket!.matches,
    })),
    event.matchMinutes,
  );
  const bySlot = new Map(slots.map((slot) => [slot.matchId, slot]));
  // Lutas já disputadas ou no placar de uma área ficam como estão.
  const movable = divisions
    .flatMap((division) => division.bracket!.matches)
    .filter((match) => match.status !== "FINISHED" && !match.currentOnMat);

  await prisma.$transaction(
    movable.map((match) => {
      const slot = bySlot.get(match.id);
      return prisma.match.update({
        where: { id: match.id },
        data: slot
          ? { matId: slot.matId, sequence: slot.sequence, scheduledAt: slot.scheduledAt }
          : { matId: null, sequence: null, scheduledAt: null },
      });
    }),
  );
  return slots.length;
}

/** Programa público do evento: as lutas de cada área por ordem, com a hora prevista. */
export async function getPublicSchedule(eventSlug: string) {
  "use cache";
  cacheLife("live");
  cacheTag(TAG.eventSlug(eventSlug));
  const event = await prisma.event.findFirst({
    where: { slug: eventSlug, status: "PUBLISHED" },
    select: {
      id: true,
      name: true,
      slug: true,
      startsAt: true,
      endsAt: true,
      mats: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          isLive: true,
          matches: { where: { sequence: { not: null } }, orderBy: { sequence: "asc" }, select: scheduledMatch },
        },
      },
    },
  });
  if (!event) return null;
  cacheTag(TAG.event(event.id));
  return event;
}

export type ScheduledMatch = Prisma.MatchGetPayload<{ select: typeof scheduledMatch }>;
