// Trava tentativas de adivinhar palavras-passe: depois de MAX_FAILURES erros seguidos
// para o mesmo e-mail, o login fica bloqueado durante WINDOW_MS.
// Fica em memória, por isso vale por processo; com vários servidores, passar isto para o banco ou Redis.

const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED = 10_000;

const failures = new Map<string, { count: number; firstAt: number }>();

function current(key: string, now: number) {
  const entry = failures.get(key);
  if (entry && now - entry.firstAt > WINDOW_MS) {
    failures.delete(key);
    return undefined;
  }
  return entry;
}

/** Minutos que faltam para poder tentar outra vez, ou 0 se pode tentar já. */
export function lockedForMinutes(key: string, now = Date.now()): number {
  const entry = current(key, now);
  if (!entry || entry.count < MAX_FAILURES) return 0;
  return Math.ceil((entry.firstAt + WINDOW_MS - now) / 60_000);
}

export function recordFailure(key: string, now = Date.now()) {
  const entry = current(key, now);
  if (entry) {
    entry.count++;
    return;
  }
  // Não deixa o mapa crescer sem fim com e-mails inventados.
  if (failures.size >= MAX_TRACKED) failures.delete(failures.keys().next().value!);
  failures.set(key, { count: 1, firstAt: now });
}

export function clearFailures(key: string) {
  failures.delete(key);
}
