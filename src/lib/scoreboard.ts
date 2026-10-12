export type Clock = {
  durationSeconds: number;
  /** Tempo que faltava quando o cronómetro foi parado (ou arrancado) pela última vez. */
  remainingMs: number;
  /** Instante (ms desde 1970) em que arrancou; null se está parado. */
  startedAt: number | null;
};

export type CornerScore = { name: string; academy: string | null; points: number; advantages: number; penalties: number };

/** O que os ecrãs de placar recebem da API. */
export type ScoreboardState = {
  matchId: string;
  eventName: string;
  divisionName: string;
  matName: string | null;
  finished: boolean;
  winner: "red" | "blue" | null;
  method: string | null;
  red: CornerScore;
  blue: CornerScore;
  clock: Clock;
  /** Hora do servidor, para os ecrãs acertarem o relógio com ele e não com o do aparelho. */
  serverNow: number;
};

export const DURATIONS = [120, 180, 240, 300, 360, 420, 480, 600];

export const METHODS = ["Pontos", "Finalização", "Vantagens", "Decisão dos árbitros", "Desclassificação", "Desistência"];

/** Tempo que falta no instante `now`, nunca abaixo de zero. */
export function clockRemainingMs(clock: Clock, now: number): number {
  const elapsed = clock.startedAt === null ? 0 : Math.max(0, now - clock.startedAt);
  return Math.max(0, clock.remainingMs - elapsed);
}

export function formatClock(ms: number): string {
  // Arredonda para cima: o placar só mostra 0:00 quando o tempo acabou mesmo.
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function formatDuration(seconds: number): string {
  return seconds % 60 === 0 ? `${seconds / 60} min` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}
