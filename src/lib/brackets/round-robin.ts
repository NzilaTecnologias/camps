import { UserError } from "@/lib/errors";
import { rankCompetitors, type Rng } from "./seeding";
import type { BracketMatch, Competitor, Placement } from "./types";

/**
 * Todos contra todos pelo método do círculo: o primeiro fica fixo e os demais giram
 * a cada rodada. Com número ímpar, um competidor folga por rodada.
 */
export function generateRoundRobin(competitors: Competitor[], rng: Rng = Math.random): BracketMatch[] {
  if (competitors.length < 2) {
    throw new UserError("Uma chave precisa de pelo menos 2 competidores");
  }

  const ids: (string | null)[] = rankCompetitors(competitors, rng).map((c) => c.id);
  if (ids.length % 2 === 1) ids.push(null);

  const matches: BracketMatch[] = [];
  const rounds = ids.length - 1;
  let rotation = ids;

  for (let round = 1; round <= rounds; round++) {
    let position = 1;
    for (let i = 0; i < rotation.length / 2; i++) {
      const red = rotation[i];
      const blue = rotation[rotation.length - 1 - i];
      if (red === null || blue === null) continue;
      matches.push({
        key: `RR${round}-M${position}`,
        round,
        position: position++,
        red,
        blue,
        winner: null,
        status: "ready",
        next: null,
        loserNext: null,
      });
    }
    rotation = [rotation[0], rotation[rotation.length - 1], ...rotation.slice(1, -1)];
  }
  return matches;
}

/**
 * Classificação por número de vitórias; empate entre dois decide no confronto direto.
 * Empates entre três ou mais ficam no mesmo lugar para o organizador desempatar.
 */
export function roundRobinPlacements(matches: BracketMatch[]): Placement[] {
  if (matches.some((m) => m.status !== "finished")) return [];

  const wins = new Map<string, number>();
  for (const m of matches) {
    for (const id of [m.red, m.blue]) if (id) wins.set(id, wins.get(id) ?? 0);
    if (m.winner) wins.set(m.winner, (wins.get(m.winner) ?? 0) + 1);
  }

  const byWins = new Map<number, string[]>();
  for (const [id, count] of wins) byWins.set(count, [...(byWins.get(count) ?? []), id]);

  const placements: Placement[] = [];
  let place = 1;
  for (const count of [...byWins.keys()].sort((a, b) => b - a)) {
    const tied = byWins.get(count) as string[];
    const headToHead =
      tied.length === 2
        ? matches.find((m) => tied.includes(m.red as string) && tied.includes(m.blue as string))
        : undefined;
    if (headToHead?.winner) {
      const loser = tied.find((id) => id !== headToHead.winner) as string;
      placements.push({ competitorId: headToHead.winner, place }, { competitorId: loser, place: place + 1 });
    } else {
      for (const id of tied) placements.push({ competitorId: id, place });
    }
    place += tied.length;
  }
  return placements;
}
