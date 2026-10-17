import { describe, expect, it } from "vitest";
import { cachedJson, memoryKV, rateLimit, redisKV } from "./kv";

describe("memoryKV", () => {
  it("guarda, expira e conta", async () => {
    let now = 1_000;
    const store = memoryKV(() => now);
    await store.set("a", "1", 500);
    expect(await store.get("a")).toBe("1");
    expect(await store.pttl("a")).toBe(500);
    now += 501;
    expect(await store.get("a")).toBeNull();

    expect(await store.incr("c", 1_000)).toBe(1);
    expect(await store.incr("c", 1_000)).toBe(2);
    now += 1_001;
    expect(await store.incr("c", 1_000)).toBe(1);
    await store.del("c");
    expect(await store.get("c")).toBeNull();
  });
});

/** Duplo mínimo do ioredis com os comandos que o redisKV usa. */
function fakeRedis() {
  const data = new Map<string, string>();
  const calls: string[] = [];
  const redis = {
    async get(key: string) {
      return data.get(key) ?? null;
    },
    async set(key: string, value: string, ...options: unknown[]) {
      calls.push(`set ${key} ${options.join(" ")}`);
      if (options.includes("NX") && data.has(key)) return null;
      data.set(key, value);
      return "OK";
    },
    async pttl(key: string) {
      return data.has(key) ? 900 : -2;
    },
    async del(key: string) {
      data.delete(key);
      return 1;
    },
    multi() {
      const queue: (() => Promise<unknown>)[] = [];
      const chain = {
        set: (key: string, value: string, ...options: unknown[]) => {
          queue.push(() => redis.set(key, value, ...options));
          return chain;
        },
        incr: (key: string) => {
          queue.push(async () => {
            const next = Number(data.get(key) ?? 0) + 1;
            data.set(key, String(next));
            return next;
          });
          return chain;
        },
        exec: async () => {
          const results: [null, unknown][] = [];
          for (const run of queue) results.push([null, await run()]);
          return results;
        },
      };
      return chain;
    },
  };
  return { redis, data, calls };
}

describe("redisKV", () => {
  it("usa o prefixo, o prazo em milissegundos e cria o contador uma só vez", async () => {
    const { redis, data, calls } = fakeRedis();
    const store = redisKV(redis as never, "t:");
    await store.set("k", "v", 1_500);
    expect(data.get("t:k")).toBe("v");
    expect(calls[0]).toBe("set t:k PX 1500");
    expect(await store.incr("n", 60_000)).toBe(1);
    expect(await store.incr("n", 60_000)).toBe(2);
    expect(await store.pttl("n")).toBe(900);
    expect(await store.pttl("ausente")).toBe(0);
  });
});

describe("cachedJson", () => {
  it("pedidos simultâneos à mesma chave fazem um só cálculo", async () => {
    let runs = 0;
    const compute = async () => {
      runs++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { value: 42 };
    };
    const key = `teste:${Math.random()}`;
    const results = await Promise.all(Array.from({ length: 50 }, () => cachedJson(key, 1_000, compute)));
    expect(results.every((result) => result.value === 42)).toBe(true);
    expect(runs).toBe(1);
    expect(await cachedJson(key, 1_000, compute)).toEqual({ value: 42 });
    expect(runs).toBe(1);
  });
});

describe("rateLimit", () => {
  it("deixa passar até ao limite e depois recusa", async () => {
    const key = `teste:${Math.random()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit(key, 3, 60_000));
    expect(results.map((result) => result.ok)).toEqual([true, true, true, false]);
    expect(results[3].retryAfterMs).toBeGreaterThan(0);
  });
});

describe("cachedJson com reserva", () => {
  it("serve o último valor bom quando o cálculo falha", async () => {
    const key = `teste:${Math.random()}`;
    await cachedJson(key, 1, async () => ({ score: 3 }), { staleOnErrorMs: 60_000 });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const value = await cachedJson(key, 1, async () => {
      throw new Error("base de dados em baixo");
    }, { staleOnErrorMs: 60_000 });
    expect(value).toEqual({ score: 3 });
  });

  it("sem reserva, o erro passa", async () => {
    const key = `teste:${Math.random()}`;
    await expect(cachedJson(key, 1, async () => Promise.reject(new Error("falhou")))).rejects.toThrow("falhou");
  });
});
