import type { Competitor } from "./types";

export type Rng = () => number;

export function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/**
 * Ordem padrão de seeds nas posições da chave: para 8, [1,8,4,5,2,7,3,6].
 * Seeds 1 e 2 só se encontram na final, 1–4 só nas semifinais, e assim por diante.
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const total = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, total - seed]);
  }
  return order;
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Devolve os competidores em ordem de seed (índice 0 = seed 1).
 * Cabeças de chave vêm primeiro; os demais são sorteados e agrupados por academia,
 * das maiores para as menores. Como seeds consecutivos (1–2, 3–4, ...) caem em metades
 * opostas da chave, companheiros de academia ficam o mais longe possível entre si.
 * É uma heurística: com 3+ atletas da mesma academia alguns dividem a mesma metade.
 */
export function rankCompetitors(competitors: Competitor[], rng: Rng = Math.random): Competitor[] {
  const seeded = competitors
    .filter((c) => c.seed != null)
    .sort((a, b) => (a.seed as number) - (b.seed as number));

  const groups = new Map<string, Competitor[]>();
  for (const c of shuffle(competitors.filter((c) => c.seed == null), rng)) {
    const groupKey = c.academyId ?? `solo:${c.id}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), c]);
  }
  const unseeded = [...groups.values()].sort((a, b) => b.length - a.length).flat();

  return [...seeded, ...unseeded];
}
