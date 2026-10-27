// O registo de um atleta a partir das lutas que disputou (as passagens diretas não contam).

export type Bout = { won: boolean; method: string | null; finishedAt: Date | null };

export type MethodShare = { method: string; count: number; share: number };

export type AthleteRecord = {
  fights: number;
  wins: number;
  losses: number;
  /** Percentagem de vitórias, arredondada; nulo sem lutas. */
  winRate: number | null;
  winsBy: MethodShare[];
  lossesBy: MethodShare[];
  /** Resultados mais recentes primeiro (até 5). */
  form: boolean[];
  /** Vitórias seguidas até à luta mais recente. */
  streak: number;
};

// Resultados lançados pelo atalho "Venceu…" da chave, sem passar pelo placar, não têm método.
const UNKNOWN = "Sem método registado";

function byMethod(bouts: Bout[]): MethodShare[] {
  const counts = new Map<string, number>();
  for (const bout of bouts) {
    const method = bout.method?.trim() || UNKNOWN;
    counts.set(method, (counts.get(method) ?? 0) + 1);
  }
  return [...counts]
    .map(([method, count]) => ({ method, count, share: count / bouts.length }))
    .sort((a, b) => b.count - a.count || a.method.localeCompare(b.method, "pt"));
}

export function athleteRecord(bouts: Bout[]): AthleteRecord {
  const recent = [...bouts].sort((a, b) => (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0));
  const wins = bouts.filter((bout) => bout.won);
  const losses = bouts.filter((bout) => !bout.won);
  const firstLoss = recent.findIndex((bout) => !bout.won);
  return {
    fights: bouts.length,
    wins: wins.length,
    losses: losses.length,
    winRate: bouts.length ? Math.round((wins.length / bouts.length) * 100) : null,
    winsBy: byMethod(wins),
    lossesBy: byMethod(losses),
    form: recent.slice(0, 5).map((bout) => bout.won),
    streak: firstLoss === -1 ? recent.length : firstLoss,
  };
}
