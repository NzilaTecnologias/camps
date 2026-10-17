import { kv } from "./kv";

// Trava tentativas de adivinhar palavras-passe: depois de MAX_FAILURES erros seguidos
// para o mesmo e-mail, o login fica bloqueado durante WINDOW_MS.
// Fica no armazém partilhado (Redis em produção), por isso vale para todos os servidores.

const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

const keyFor = (email: string) => `login-fail:${email}`;

/** Minutos que faltam para poder tentar outra vez, ou 0 se pode tentar já. */
export async function lockedForMinutes(email: string): Promise<number> {
  const store = await kv();
  const count = Number((await store.get(keyFor(email))) ?? 0);
  if (count < MAX_FAILURES) return 0;
  return Math.max(1, Math.ceil((await store.pttl(keyFor(email))) / 60_000));
}

export async function recordFailure(email: string) {
  await (await kv()).incr(keyFor(email), WINDOW_MS);
}

export async function clearFailures(email: string) {
  await (await kv()).del(keyFor(email));
}
