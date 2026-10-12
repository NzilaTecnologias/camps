import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { clockRemainingMs, DURATIONS, METHODS, type ScoreboardState } from "@/lib/scoreboard";
import { parseStreamUrl } from "@/lib/stream";
import { reportResult } from "./brackets";
import { memberOf } from "./manage";

const corner = {
  select: { id: true, athlete: { select: { firstName: true, lastName: true, academy: { select: { name: true } } } } },
} satisfies Prisma.RegistrationDefaultArgs;

const scoreboardInclude = {
  red: corner,
  blue: corner,
  mat: { select: { name: true } },
  bracket: {
    select: { division: { select: { name: true, event: { select: { name: true, status: true, organizerId: true } } } } },
  },
} satisfies Prisma.MatchInclude;

type MatchWithScoreboard = Prisma.MatchGetPayload<{ include: typeof scoreboardInclude }>;

function toState(match: MatchWithScoreboard): ScoreboardState {
  const side = (registration: MatchWithScoreboard["red"], points: number, advantages: number, penalties: number) => ({
    name: registration ? `${registration.athlete.firstName} ${registration.athlete.lastName}` : "A definir",
    academy: registration?.athlete.academy?.name ?? null,
    points,
    advantages,
    penalties,
  });
  return {
    matchId: match.id,
    eventName: match.bracket.division.event.name,
    divisionName: match.bracket.division.name,
    matName: match.mat?.name ?? null,
    finished: match.status === "FINISHED",
    winner: match.winnerId === null ? null : match.winnerId === match.redId ? "red" : "blue",
    method: match.method,
    red: side(match.red, match.redScore, match.redAdvantages, match.redPenalties),
    blue: side(match.blue, match.blueScore, match.blueAdvantages, match.bluePenalties),
    clock: {
      durationSeconds: match.durationSeconds,
      remainingMs: match.clockRemainingMs ?? match.durationSeconds * 1000,
      startedAt: match.clockStartedAt?.getTime() ?? null,
    },
    serverNow: Date.now(),
  };
}

/** Placar de uma luta. Eventos por publicar só são visíveis a quem os organiza. */
export async function getMatchState(matchId: string, viewerId: string | null): Promise<ScoreboardState | null> {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: scoreboardInclude });
  if (!match) return null;
  const { event } = match.bracket.division;
  if (event.status !== "PUBLISHED") {
    const isMember =
      viewerId !== null &&
      (await prisma.organizerMember.count({ where: { organizerId: event.organizerId, userId: viewerId } })) > 0;
    if (!isMember) return null;
  }
  return toState(match);
}

export type MatState = { matName: string; eventName: string; scoreboard: ScoreboardState | null };

/** O que o ecrã de TV e a sobreposição de uma área mostram: a luta que está agora no placar, se houver. */
export async function getMatState(matId: string): Promise<MatState | null> {
  const mat = await prisma.mat.findFirst({
    where: { id: matId, event: { status: "PUBLISHED" } },
    include: { event: { select: { name: true } }, currentMatch: { include: scoreboardInclude } },
  });
  if (!mat) return null;
  return {
    matName: mat.name,
    eventName: mat.event.name,
    scoreboard: mat.currentMatch ? toState(mat.currentMatch) : null,
  };
}

async function requireOpenMatch(userId: string, matchId: string) {
  const match = await prisma.match.findFirst({
    where: { id: matchId, bracket: { division: { event: memberOf(userId) } } },
    include: { bracket: { select: { division: { select: { eventId: true } } } } },
  });
  if (!match) throw new UserError("Luta não encontrada");
  if (match.status !== "READY") throw new UserError("Esta luta ainda não está pronta ou já terminou");
  return match;
}

/** Põe a luta no placar de uma área e define a duração, se o cronómetro ainda não arrancou. */
export async function openScoreboard(userId: string, matchId: string, matId: string, durationSeconds: number) {
  const match = await requireOpenMatch(userId, matchId);
  if (!DURATIONS.includes(durationSeconds)) throw new UserError("Duração inválida");
  const mat = matId
    ? await prisma.mat.findFirst({ where: { id: matId, eventId: match.bracket.division.eventId } })
    : null;
  if (matId && !mat) throw new UserError("Área de luta não encontrada");

  const untouched = match.clockRemainingMs === null;
  await prisma.$transaction(async (tx) => {
    // Uma luta só pode estar no placar de uma área de cada vez.
    await tx.mat.updateMany({ where: { currentMatchId: match.id }, data: { currentMatchId: null } });
    if (mat) await tx.mat.update({ where: { id: mat.id }, data: { currentMatchId: match.id } });
    await tx.match.update({
      where: { id: match.id },
      data: {
        matId: mat?.id ?? null,
        ...(untouched ? { durationSeconds, clockRemainingMs: durationSeconds * 1000 } : {}),
      },
    });
  });
}

const SCORE_FIELDS = {
  red: { points: "redScore", advantages: "redAdvantages", penalties: "redPenalties" },
  blue: { points: "blueScore", advantages: "blueAdvantages", penalties: "bluePenalties" },
} as const;

export type Corner = keyof typeof SCORE_FIELDS;
export type ScoreField = keyof (typeof SCORE_FIELDS)["red"];

export async function adjustScore(userId: string, matchId: string, side: string, field: string, delta: number) {
  const match = await requireOpenMatch(userId, matchId);
  if (side !== "red" && side !== "blue") throw new UserError("Canto inválido");
  if (field !== "points" && field !== "advantages" && field !== "penalties") throw new UserError("Marcador inválido");
  if (!Number.isInteger(delta) || Math.abs(delta) > 4) throw new UserError("Valor inválido");

  const column = SCORE_FIELDS[side][field];
  await prisma.match.update({ where: { id: match.id }, data: { [column]: Math.max(0, match[column] + delta) } });
}

export async function controlClock(userId: string, matchId: string, action: string) {
  const match = await requireOpenMatch(userId, matchId);
  const now = Date.now();
  const clock = {
    durationSeconds: match.durationSeconds,
    remainingMs: match.clockRemainingMs ?? match.durationSeconds * 1000,
    startedAt: match.clockStartedAt?.getTime() ?? null,
  };
  const remaining = clockRemainingMs(clock, now);

  const data =
    action === "start"
      ? { clockRemainingMs: remaining, clockStartedAt: remaining > 0 ? new Date(now) : null }
      : action === "pause"
        ? { clockRemainingMs: remaining, clockStartedAt: null }
        : action === "reset"
          ? { clockRemainingMs: match.durationSeconds * 1000, clockStartedAt: null }
          : null;
  if (!data) throw new UserError("Ação de cronómetro inválida");
  await prisma.match.update({ where: { id: match.id }, data });
}

/** Termina a luta no placar: grava o resultado, avança a chave e liberta a área. */
export async function finishMatch(userId: string, matchId: string, winner: string, method: string) {
  const match = await requireOpenMatch(userId, matchId);
  if (winner !== "red" && winner !== "blue") throw new UserError("Escolha o vencedor");
  if (!METHODS.includes(method)) throw new UserError("Escolha como a luta terminou");
  const winnerId = winner === "red" ? match.redId : match.blueId;
  if (!winnerId) throw new UserError("Esta luta ainda não tem os dois atletas");

  // Pára o cronómetro onde estava, para o placar final mostrar o tempo certo.
  await controlClock(userId, matchId, "pause");
  await reportResult(match.id, winnerId, { method, redScore: match.redScore, blueScore: match.blueScore });
  await prisma.mat.updateMany({ where: { currentMatchId: match.id }, data: { currentMatchId: null } });
}

async function requireMat(userId: string, matId: string) {
  const mat = await prisma.mat.findFirst({ where: { id: matId, event: memberOf(userId) } });
  if (!mat) throw new UserError("Área de luta não encontrada");
  return mat;
}

export async function createMat(userId: string, eventId: string, name: string) {
  const event = await prisma.event.findFirst({ where: { id: eventId, ...memberOf(userId) } });
  if (!event) throw new UserError("Evento não encontrado");
  if (!name) throw new UserError("Informe o nome da área");
  if (await prisma.mat.findUnique({ where: { eventId_name: { eventId, name } } })) {
    throw new UserError("Já existe uma área com esse nome");
  }
  const sortOrder = (await prisma.mat.count({ where: { eventId } })) + 1;
  await prisma.mat.create({ data: { eventId, name, sortOrder } });
}

/** Guarda o endereço da transmissão de uma área. Vazio apaga-o e tira a área do ar. */
export async function setMatStream(userId: string, matId: string, streamUrl: string) {
  const mat = await requireMat(userId, matId);
  if (!streamUrl) {
    await prisma.mat.update({ where: { id: mat.id }, data: { streamUrl: null, isLive: false } });
    return;
  }
  if (!parseStreamUrl(streamUrl)) {
    throw new UserError("Cole o endereço de um vídeo ou direto do YouTube ou do Facebook (começado por https://)");
  }
  await prisma.mat.update({ where: { id: mat.id }, data: { streamUrl } });
}

export async function setMatLive(userId: string, matId: string, isLive: boolean) {
  const mat = await requireMat(userId, matId);
  if (isLive && !mat.streamUrl) throw new UserError("Guarde primeiro o endereço da transmissão");
  await prisma.mat.update({ where: { id: mat.id }, data: { isLive } });
}

/** Tudo o que a página de controlo do placar precisa, só para quem organiza o evento. */
export async function getScoreboardControl(userId: string, matchId: string) {
  const match = await prisma.match.findFirst({
    where: { id: matchId, bracket: { division: { event: memberOf(userId) } } },
    include: {
      ...scoreboardInclude,
      bracket: {
        select: {
          division: {
            select: {
              id: true,
              name: true,
              event: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                  organizerId: true,
                  mats: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!match) return null;
  const { division } = match.bracket;
  return {
    state: toState(match),
    status: match.status,
    isOpen: match.clockRemainingMs !== null,
    matId: match.matId,
    mats: division.event.mats,
    eventId: division.event.id,
    divisionId: division.id,
  };
}
