import { BRONZE_KEY } from "./brackets/single-elimination";
import { GRAND_FINAL_KEY } from "./brackets/double-elimination";

// Programação das lutas: cada categoria é disputada numa área, e cada área tem uma hora de
// início. As lutas de todas as categorias de uma área entram por ronda (primeiro as primeiras
// rondas de todas, depois as segundas…), para os atletas descansarem entre lutas, e cada uma ocupa
// `matchMinutes` (a luta mais a troca de atletas). As horas são uma previsão.

export type ScheduleBracketType = "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION" | "ROUND_ROBIN";

export type ScheduleMatch = {
  id: string;
  key: string;
  round: number;
  position: number;
  status: "PENDING" | "READY" | "BYE" | "FINISHED";
  nextKey: string | null;
};

export type ScheduleDivision = {
  id: string;
  matId: string | null;
  bracketType: ScheduleBracketType;
  matches: ScheduleMatch[];
};

export type ScheduleMat = { id: string; startsAt: Date | null };

export type ScheduledSlot = { matchId: string; matId: string; sequence: number; scheduledAt: Date | null };

/**
 * Ordem de jogo dentro da chave: uma luta nunca vem antes das que a alimentam. Na eliminação
 * simples a final fica depois da disputa de bronze; na dupla eliminação as rondas da chave dos
 * vencidos intercalam-se com as da principal de onde caem os atletas.
 */
export function playOrder(type: ScheduleBracketType, match: Pick<ScheduleMatch, "key" | "round" | "nextKey">): number {
  if (type === "DOUBLE_ELIMINATION") {
    if (match.key === GRAND_FINAL_KEY) return Number.MAX_SAFE_INTEGER;
    // Principal: ronda r na posição 2r-1. Vencidos: a ronda 1 logo a seguir à 1.ª da principal,
    // a ronda m (m ≥ 2) na posição m+2, depois da ronda da principal que lhe manda atletas.
    if (match.key.startsWith("L")) return match.round === 1 ? 2 : match.round + 2;
    return 2 * match.round - 1;
  }
  if (type === "SINGLE_ELIMINATION") {
    const isFinal = match.nextKey === null && match.key !== BRONZE_KEY;
    return match.round * 2 + (isFinal ? 1 : 0);
  }
  return match.round;
}

/**
 * Distribui as lutas de cada área pela ordem de jogo, com a hora prevista de cada uma. As
 * passagens diretas (byes) não ocupam lugar. As categorias sem área ficam fora da programação.
 */
export function buildSchedule(mats: ScheduleMat[], divisions: ScheduleDivision[], matchMinutes: number): ScheduledSlot[] {
  const slots: ScheduledSlot[] = [];
  for (const mat of mats) {
    const queue = divisions
      .map((division, index) => ({ division, index }))
      .filter(({ division }) => division.matId === mat.id)
      .flatMap(({ division, index }) =>
        division.matches
          .filter((match) => match.status !== "BYE")
          .map((match) => ({ match, index, order: playOrder(division.bracketType, match) })),
      )
      .sort((a, b) => a.order - b.order || a.index - b.index || a.match.position - b.match.position);

    queue.forEach(({ match }, i) => {
      slots.push({
        matchId: match.id,
        matId: mat.id,
        sequence: i + 1,
        scheduledAt: mat.startsAt ? new Date(mat.startsAt.getTime() + i * matchMinutes * 60_000) : null,
      });
    });
  }
  return slots;
}

/**
 * Reparte as categorias pelas áreas para que acabem mais ou menos à mesma hora: as categorias
 * com mais lutas primeiro, cada uma para a área com menos lutas até ali. Devolve a área de cada
 * categoria.
 */
export function balanceDivisions(matIds: string[], divisions: { id: string; matches: number }[]): Map<string, string> {
  const load = new Map(matIds.map((id) => [id, 0]));
  const assignment = new Map<string, string>();
  if (matIds.length === 0) return assignment;
  for (const division of [...divisions].sort((a, b) => b.matches - a.matches)) {
    const [lightest] = [...load.entries()].sort((a, b) => a[1] - b[1]);
    assignment.set(division.id, lightest[0]);
    load.set(lightest[0], lightest[1] + division.matches);
  }
  return assignment;
}
