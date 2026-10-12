import { UserError } from "@/lib/errors";
import { nextPowerOfTwo, rankCompetitors, seedOrder, type Rng } from "./seeding";
import type { BracketMatch, Competitor, Placement } from "./types";

export const BRONZE_KEY = "BRONZE";

const matchKey = (round: number, position: number) => `R${round}-M${position}`;

export type SingleEliminationOptions = {
  bronzeMatch?: boolean;
  rng?: Rng;
};

/**
 * Gera uma chave de eliminação simples. A chave é completada com byes até a próxima
 * potência de 2; os byes vão para os melhores seeds, que avançam direto para a 2ª rodada.
 */
export function generateSingleElimination(
  competitors: Competitor[],
  { bronzeMatch = true, rng = Math.random }: SingleEliminationOptions = {},
): BracketMatch[] {
  if (competitors.length < 2) {
    throw new UserError("Uma chave precisa de pelo menos 2 competidores");
  }

  const ranked = rankCompetitors(competitors, rng);
  const size = nextPowerOfTwo(ranked.length);
  const rounds = Math.log2(size);
  const slots = seedOrder(size).map((seed) => ranked[seed - 1]?.id ?? null);

  const matches: BracketMatch[] = [];
  for (let round = 1; round <= rounds; round++) {
    const count = size / 2 ** round;
    for (let position = 1; position <= count; position++) {
      const isFinal = round === rounds;
      matches.push({
        key: matchKey(round, position),
        round,
        position,
        red: round === 1 ? slots[(position - 1) * 2] : null,
        blue: round === 1 ? slots[(position - 1) * 2 + 1] : null,
        winner: null,
        status: "pending",
        next: isFinal
          ? null
          : { key: matchKey(round + 1, Math.ceil(position / 2)), slot: position % 2 === 1 ? "red" : "blue" },
        loserNext: null,
      });
    }
  }

  // Bronze só faz sentido com duas semifinais de verdade: com 3 competidores uma delas é bye.
  if (bronzeMatch && ranked.length >= 4) {
    for (const semi of matches.filter((m) => m.round === rounds - 1)) {
      semi.loserNext = { key: BRONZE_KEY, slot: semi.position === 1 ? "red" : "blue" };
    }
    matches.push({
      key: BRONZE_KEY,
      round: rounds,
      position: 2,
      red: null,
      blue: null,
      winner: null,
      status: "pending",
      next: null,
      loserNext: null,
    });
  }

  let resolved = matches;
  for (const match of matches.filter((m) => m.round === 1)) {
    const bye = match.red === null ? match.blue : match.blue === null ? match.red : null;
    if (bye !== null) {
      resolved = place(resolved, match.next, bye).map((m) =>
        m.key === match.key ? { ...m, winner: bye, status: "bye" } : m,
      );
    }
  }
  return resolved.map(refreshStatus);
}

function refreshStatus(match: BracketMatch): BracketMatch {
  if (match.status === "bye" || match.status === "finished") return match;
  return { ...match, status: match.red && match.blue ? "ready" : "pending" };
}

function place(matches: BracketMatch[], link: BracketMatch["next"], competitorId: string): BracketMatch[] {
  if (!link) return matches;
  return matches.map((m) => (m.key === link.key ? refreshStatus({ ...m, [link.slot]: competitorId }) : m));
}

/** Registra o vencedor de uma luta e move vencedor e perdedor para as próximas lutas. */
export function recordResult(matches: BracketMatch[], key: string, winnerId: string): BracketMatch[] {
  const match = matches.find((m) => m.key === key);
  if (!match) throw new UserError(`Luta ${key} não existe`);
  if (match.status !== "ready") throw new UserError(`Luta ${key} não está pronta para receber resultado`);
  if (winnerId !== match.red && winnerId !== match.blue) {
    throw new UserError(`Competidor ${winnerId} não está na luta ${key}`);
  }
  const loserId = (winnerId === match.red ? match.blue : match.red) as string;

  let updated = matches.map((m) => (m.key === key ? { ...m, winner: winnerId, status: "finished" as const } : m));
  updated = place(updated, match.next, winnerId);
  updated = place(updated, match.loserNext, loserId);
  return updated;
}

/**
 * Pódio de uma chave encerrada: 1º e 2º da final; 3º e 4º da disputa de bronze,
 * ou dois terceiros lugares quando não há disputa de bronze.
 */
export function singleEliminationPlacements(matches: BracketMatch[]): Placement[] {
  const rounds = Math.max(...matches.map((m) => m.round));
  const final = matches.find((m) => m.round === rounds && m.key !== BRONZE_KEY);
  if (!final?.winner) return [];

  const loserOf = (m: BracketMatch) => (m.winner === m.red ? m.blue : m.red);
  const placements: Placement[] = [{ competitorId: final.winner, place: 1 }];
  const runnerUp = loserOf(final);
  if (runnerUp) placements.push({ competitorId: runnerUp, place: 2 });

  const bronze = matches.find((m) => m.key === BRONZE_KEY);
  if (bronze) {
    if (bronze.winner) {
      placements.push({ competitorId: bronze.winner, place: 3 });
      const fourth = loserOf(bronze);
      if (fourth) placements.push({ competitorId: fourth, place: 4 });
    }
    return placements;
  }

  for (const semi of matches.filter((m) => m.round === rounds - 1 && m.status === "finished")) {
    const third = loserOf(semi);
    if (third) placements.push({ competitorId: third, place: 3 });
  }
  return placements;
}
