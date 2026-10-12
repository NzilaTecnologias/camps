export type Slot = "red" | "blue";

export type Competitor = {
  id: string;
  academyId?: string | null;
  /** 1 = cabeça de chave nº 1. Sem seed = sorteado. */
  seed?: number | null;
};

export type MatchStatus = "pending" | "ready" | "bye" | "finished";

export type MatchLink = { key: string; slot: Slot };

export type BracketMatch = {
  /** Identificador estável dentro da chave, ex.: "R1-M3", "BRONZE", "RR2-M1". */
  key: string;
  round: number;
  position: number;
  red: string | null;
  blue: string | null;
  winner: string | null;
  status: MatchStatus;
  /** Para onde vai o vencedor. */
  next: MatchLink | null;
  /** Para onde vai o perdedor (disputa de bronze). */
  loserNext: MatchLink | null;
};

export type Placement = { competitorId: string; place: number };
