import { UserError } from "@/lib/errors";
import { nextPowerOfTwo, rankCompetitors, seedOrder, type Rng } from "./seeding";
import { recordResult } from "./single-elimination";
import type { BracketMatch, Competitor, MatchLink, Placement, Slot } from "./types";

export const GRAND_FINAL_KEY = "GF";

const winnersKey = (round: number, position: number) => `W${round}-M${position}`;
const losersKey = (round: number, position: number) => `L${round}-M${position}`;
const slotFor = (position: number): Slot => (position % 2 === 1 ? "red" : "blue");

/** Lutas por ronda da chave dos vencidos: as rondas vão aos pares (entre si, depois contra quem cai). */
const losersCount = (size: number, round: number) => size / 2 ** (Math.ceil(round / 2) + 1);

/**
 * Gera uma chave de dupla eliminação. A chave principal é a de eliminação simples; quem perde
 * nela cai na chave dos vencidos, onde uma segunda derrota elimina. O vencedor de cada chave
 * encontra-se na final, que é uma luta única. Os byes vão para os melhores seeds, como na
 * eliminação simples, e as passagens diretas na chave dos vencidos resolvem-se sozinhas.
 */
export function generateDoubleElimination(competitors: Competitor[], rng: Rng = Math.random): BracketMatch[] {
  if (competitors.length < 3) {
    throw new UserError("A dupla eliminação precisa de pelo menos 3 competidores");
  }

  const ranked = rankCompetitors(competitors, rng);
  const size = nextPowerOfTwo(ranked.length);
  const rounds = Math.log2(size);
  const losersRounds = 2 * (rounds - 1);
  const slots = seedOrder(size).map((seed) => ranked[seed - 1]?.id ?? null);
  const matches: BracketMatch[] = [];

  for (let round = 1; round <= rounds; round++) {
    const count = size / 2 ** round;
    for (let position = 1; position <= count; position++) {
      // Quem cai da chave principal entra na ronda par da chave dos vencidos. Nas rondas pares da
      // principal a ordem inverte-se, para não repetir logo o confronto de onde o atleta veio.
      const drop = count - position + 1;
      const loserNext: MatchLink =
        round === 1
          ? { key: losersKey(1, Math.ceil(position / 2)), slot: slotFor(position) }
          : { key: losersKey(2 * (round - 1), round % 2 === 0 ? drop : position), slot: "blue" };
      matches.push({
        key: winnersKey(round, position),
        round,
        position,
        red: round === 1 ? slots[(position - 1) * 2] : null,
        blue: round === 1 ? slots[(position - 1) * 2 + 1] : null,
        winner: null,
        status: "pending",
        next:
          round === rounds
            ? { key: GRAND_FINAL_KEY, slot: "red" }
            : { key: winnersKey(round + 1, Math.ceil(position / 2)), slot: slotFor(position) },
        loserNext,
      });
    }
  }

  for (let round = 1; round <= losersRounds; round++) {
    const count = losersCount(size, round);
    for (let position = 1; position <= count; position++) {
      const next: MatchLink =
        round === losersRounds
          ? { key: GRAND_FINAL_KEY, slot: "blue" }
          : round % 2 === 1
            ? { key: losersKey(round + 1, position), slot: "red" }
            : { key: losersKey(round + 1, Math.ceil(position / 2)), slot: slotFor(position) };
      matches.push({
        key: losersKey(round, position),
        round,
        position,
        red: null,
        blue: null,
        winner: null,
        status: "pending",
        next,
        loserNext: null,
      });
    }
  }

  matches.push({
    key: GRAND_FINAL_KEY,
    round: rounds + 1,
    position: 1,
    red: null,
    blue: null,
    winner: null,
    status: "pending",
    next: null,
    loserNext: null,
  });

  return resolveByes(matches);
}

type Source = { key: string; kind: "winner" | "loser" };

function sourcesOf(matches: BracketMatch[]): Map<string, Source> {
  const sources = new Map<string, Source>();
  for (const match of matches) {
    if (match.next) sources.set(`${match.next.key}:${match.next.slot}`, { key: match.key, kind: "winner" });
    if (match.loserNext) sources.set(`${match.loserNext.key}:${match.loserNext.slot}`, { key: match.key, kind: "loser" });
  }
  return sources;
}

/**
 * Resolve as lutas que nunca vão ter dois atletas. Um lado fica vazio para sempre quando não há
 * luta que o alimente (bye na primeira ronda), quando vem do perdedor de uma passagem direta, ou
 * quando vem de uma luta que ficou sem ninguém. Com um atleta e o outro lado vazio, ele passa
 * direto; sem nenhum, a luta fica como passagem sem vencedor. Repete até nada mudar.
 */
export function resolveByes(matches: BracketMatch[]): BracketMatch[] {
  const sources = sourcesOf(matches);
  let current = matches;
  for (let changed = true; changed; ) {
    changed = false;
    const byKey = new Map(current.map((match) => [match.key, match]));
    const side = (match: BracketMatch, slot: Slot) => {
      if (match[slot] !== null) return "filled";
      const source = sources.get(`${match.key}:${slot}`);
      if (!source) return "empty";
      const from = byKey.get(source.key) as BracketMatch;
      return from.status === "bye" && (source.kind === "loser" || from.winner === null) ? "empty" : "waiting";
    };

    for (const match of current) {
      if (match.status === "finished" || match.status === "bye") continue;
      const red = side(match, "red");
      const blue = side(match, "blue");
      if (red === "waiting" || blue === "waiting") continue;
      if (red === "filled" && blue === "filled") {
        if (match.status === "ready") continue;
        current = current.map((m) => (m.key === match.key ? { ...m, status: "ready" } : m));
      } else {
        const winner = red === "filled" ? match.red : blue === "filled" ? match.blue : null;
        current = current.map((m) => (m.key === match.key ? { ...m, winner, status: "bye" } : m));
        const link = match.next;
        if (winner && link) current = current.map((m) => (m.key === link.key ? { ...m, [link.slot]: winner } : m));
      }
      changed = true;
      break;
    }
  }
  return current;
}

/** Regista o vencedor, manda o perdedor para a chave dos vencidos e resolve as passagens diretas. */
export function recordDoubleEliminationResult(matches: BracketMatch[], key: string, winnerId: string): BracketMatch[] {
  return resolveByes(recordResult(matches, key, winnerId));
}

/**
 * Pódio: 1.º e 2.º da final; 3.º quem perde a final da chave dos vencidos; 4.º quem perde a
 * ronda anterior dela, se foi disputada.
 */
export function doubleEliminationPlacements(matches: BracketMatch[]): Placement[] {
  const final = matches.find((m) => m.key === GRAND_FINAL_KEY);
  if (!final?.winner) return [];
  const loserOf = (m: BracketMatch) => (m.winner === m.red ? m.blue : m.red);
  const placements: Placement[] = [{ competitorId: final.winner, place: 1 }];
  const runnerUp = loserOf(final);
  if (runnerUp) placements.push({ competitorId: runnerUp, place: 2 });

  const rounds = Math.max(...matches.filter((m) => m.key.startsWith("W")).map((m) => m.round));
  for (const [round, place] of [
    [2 * (rounds - 1), 3],
    [2 * (rounds - 1) - 1, 4],
  ]) {
    const match = matches.find((m) => m.key === losersKey(round, 1));
    const loser = match?.status === "finished" ? loserOf(match) : null;
    if (loser) placements.push({ competitorId: loser, place });
  }
  return placements;
}

/** Em que parte da chave está a luta: principal, dos vencidos ou a final. */
export function doubleEliminationSection(key: string): "winners" | "losers" | "final" {
  return key === GRAND_FINAL_KEY ? "final" : key.startsWith("L") ? "losers" : "winners";
}
