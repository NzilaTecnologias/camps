import type { Redis } from "ioredis";

// Armazém chave-valor partilhado: cache curta, limites de pedidos e bloqueios entre servidores.
// Com REDIS_URL usa o Redis, e todas as cópias da aplicação veem os mesmos valores. Sem ele usa
// a memória do processo, o que chega para desenvolvimento e para um único servidor.
// Se o Redis falhar, a operação cai para a memória: a aplicação degrada, não pára.

export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
  /** Incrementa e devolve o novo valor; a chave nasce com o prazo dado. */
  incr(key: string, ttlMs: number): Promise<number>;
  /** Milissegundos que faltam para a chave expirar, ou 0 se não existe. */
  pttl(key: string): Promise<number>;
  del(key: string): Promise<void>;
}

const MAX_MEMORY_KEYS = 50_000;

export function memoryKV(now: () => number = Date.now): KV {
  const store = new Map<string, { value: string; expiresAt: number }>();
  const live = (key: string) => {
    const entry = store.get(key);
    if (entry && entry.expiresAt <= now()) {
      store.delete(key);
      return undefined;
    }
    return entry;
  };
  const put = (key: string, value: string, ttlMs: number) => {
    // Map mantém a ordem de inserção: a chave mais antiga é a primeira a sair.
    if (!store.has(key) && store.size >= MAX_MEMORY_KEYS) store.delete(store.keys().next().value!);
    store.set(key, { value, expiresAt: now() + ttlMs });
  };
  return {
    async get(key) {
      return live(key)?.value ?? null;
    },
    async set(key, value, ttlMs) {
      put(key, value, ttlMs);
    },
    async incr(key, ttlMs) {
      const entry = live(key);
      if (!entry) {
        put(key, "1", ttlMs);
        return 1;
      }
      entry.value = String(Number(entry.value) + 1);
      return Number(entry.value);
    },
    async pttl(key) {
      const entry = live(key);
      return entry ? entry.expiresAt - now() : 0;
    },
    async del(key) {
      store.delete(key);
    },
  };
}

export function redisKV(redis: Pick<Redis, "get" | "set" | "pttl" | "del" | "multi">, prefix = "camps:"): KV {
  return {
    async get(key) {
      return redis.get(prefix + key);
    },
    async set(key, value, ttlMs) {
      await redis.set(prefix + key, value, "PX", ttlMs);
    },
    async incr(key, ttlMs) {
      // Cria a chave a 0 com prazo só se ainda não existir, e depois incrementa: o prazo
      // conta desde o primeiro pedido da janela.
      const result = await redis.multi().set(prefix + key, "0", "PX", ttlMs, "NX").incr(prefix + key).exec();
      return Number(result?.[1]?.[1] ?? 0);
    },
    async pttl(key) {
      return Math.max(0, await redis.pttl(prefix + key));
    },
    async del(key) {
      await redis.del(prefix + key);
    },
  };
}

/** Usa o principal e, se ele falhar, o de reserva (com aviso no registo, no máximo uma vez por minuto). */
function withFallback(primary: KV, fallback: KV): KV {
  let lastWarning = 0;
  const guard =
    <A extends unknown[], R>(name: keyof KV, run: (kv: KV, ...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      try {
        return await run(primary, ...args);
      } catch (error) {
        if (Date.now() - lastWarning > 60_000) {
          lastWarning = Date.now();
          console.error(`Redis indisponível em ${name}; a usar a memória deste servidor`, error);
        }
        return run(fallback, ...args);
      }
    };
  return {
    get: guard("get", (kv, key: string) => kv.get(key)),
    set: guard("set", (kv, key: string, value: string, ttl: number) => kv.set(key, value, ttl)),
    incr: guard("incr", (kv, key: string, ttl: number) => kv.incr(key, ttl)),
    pttl: guard("pttl", (kv, key: string) => kv.pttl(key)),
    del: guard("del", (kv, key: string) => kv.del(key)),
  };
}

const globalForKV = globalThis as unknown as { campsKV?: Promise<KV> };

async function createKV(): Promise<KV> {
  const memory = memoryKV();
  const url = process.env.REDIS_URL;
  if (!url) return memory;
  const { default: IORedis } = await import("ioredis");
  const redis = new IORedis(url, {
    // Falha depressa em vez de pendurar pedidos quando o Redis cai.
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2_000,
    lazyConnect: false,
  });
  redis.on("error", () => {
    // Os erros já são tratados (e registados) em withFallback.
  });
  return withFallback(redisKV(redis), memory);
}

export function kv(): Promise<KV> {
  globalForKV.campsKV ??= createKV();
  return globalForKV.campsKV;
}

// Pedidos iguais em simultâneo esperam pelo mesmo cálculo em vez de irem todos à base de dados.
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Valor em cache durante `ttlMs`. O resultado tem de ser JSON simples (sem Date nem Decimal).
 * Com 10 000 pedidos por segundo à mesma chave, a base de dados vê 1 consulta por intervalo.
 */
export async function cachedJson<T>(
  key: string,
  ttlMs: number,
  compute: () => Promise<T>,
  options: { staleOnErrorMs?: number } = {},
): Promise<T> {
  const store = await kv();
  const hit = await store.get(key);
  if (hit !== null) return JSON.parse(hit) as T;

  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const work = (async () => {
    try {
      const value = await compute();
      const json = JSON.stringify(value);
      await store.set(key, json, ttlMs);
      // Cópia de reserva mais duradoura: se a base de dados falhar, serve-se o último valor bom.
      if (options.staleOnErrorMs) await store.set(`${key}:stale`, json, options.staleOnErrorMs);
      return value;
    } catch (error) {
      const stale = options.staleOnErrorMs ? await store.get(`${key}:stale`) : null;
      if (stale === null) throw error;
      console.error(`A servir ${key} da reserva: o cálculo falhou`, error);
      return JSON.parse(stale) as T;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, work);
  return work;
}

export type RateLimit = { ok: boolean; retryAfterMs: number };

/** Janela fixa: no máximo `limit` pedidos por `windowMs` para esta chave. */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimit> {
  const store = await kv();
  const window = Math.floor(Date.now() / windowMs);
  const bucket = `rl:${key}:${window}`;
  const count = await store.incr(bucket, windowMs);
  if (count <= limit) return { ok: true, retryAfterMs: 0 };
  return { ok: false, retryAfterMs: (window + 1) * windowMs - Date.now() };
}
