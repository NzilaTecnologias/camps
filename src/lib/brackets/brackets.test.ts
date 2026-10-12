import { describe, expect, it } from "vitest";
import {
  BRONZE_KEY,
  generateRoundRobin,
  generateSingleElimination,
  recordResult,
  roundRobinPlacements,
  seedOrder,
  singleEliminationPlacements,
  type BracketMatch,
  type Competitor,
} from ".";

const fixedRng = () => 0.42;

const athletes = (n: number, academyOf: (i: number) => string | null = () => null): Competitor[] =>
  Array.from({ length: n }, (_, i) => ({ id: `a${i + 1}`, academyId: academyOf(i) }));

const byKey = (matches: BracketMatch[], key: string) => matches.find((m) => m.key === key) as BracketMatch;

/** Joga a chave inteira dando a vitória sempre ao canto vermelho. */
function playOut(matches: BracketMatch[]): BracketMatch[] {
  let current = matches;
  for (;;) {
    const ready = current.find((m) => m.status === "ready");
    if (!ready) return current;
    current = recordResult(current, ready.key, ready.red as string);
  }
}

describe("seedOrder", () => {
  it("mantém os melhores seeds separados até as rodadas finais", () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe("eliminação simples", () => {
  it("gera 7 lutas mais a disputa de bronze para 8 competidores", () => {
    const matches = generateSingleElimination(athletes(8), { rng: fixedRng });
    expect(matches).toHaveLength(8);
    expect(matches.filter((m) => m.round === 1).every((m) => m.status === "ready")).toBe(true);
    expect(byKey(matches, BRONZE_KEY).status).toBe("pending");
  });

  it("dá bye aos melhores seeds quando o número não é potência de 2", () => {
    const competitors = athletes(5).map((c, i) => ({ ...c, seed: i + 1 }));
    const matches = generateSingleElimination(competitors, { rng: fixedRng });

    const byes = matches.filter((m) => m.status === "bye");
    expect(byes.map((m) => m.winner).sort()).toEqual(["a1", "a2", "a3"]);
    // Só os seeds 4 e 5 lutam na primeira rodada.
    const firstRoundFights = matches.filter((m) => m.round === 1 && m.status === "ready");
    expect(firstRoundFights).toHaveLength(1);
    expect([firstRoundFights[0].red, firstRoundFights[0].blue].sort()).toEqual(["a4", "a5"]);
    // Seed 1 já espera na semifinal.
    expect(byKey(matches, "R2-M1").red).toBe("a1");
  });

  it("coloca os seeds 1 e 2 em metades opostas", () => {
    const competitors = athletes(8).map((c, i) => ({ ...c, seed: i + 1 }));
    const matches = generateSingleElimination(competitors);
    const half = (id: string) => {
      const m = matches.find((x) => x.round === 1 && (x.red === id || x.blue === id)) as BracketMatch;
      return m.position <= 2 ? "top" : "bottom";
    };
    expect(half("a1")).not.toBe(half("a2"));
  });

  it("separa dois atletas da mesma academia em metades opostas", () => {
    for (let seed = 0; seed < 20; seed++) {
      let state = seed + 1;
      const rng = () => (state = (state * 16807) % 2147483647) / 2147483647;
      const competitors = athletes(8, (i) => (i < 2 ? "gracie" : null));
      const matches = generateSingleElimination(competitors, { rng });
      const half = (id: string) => {
        const m = matches.find((x) => x.round === 1 && (x.red === id || x.blue === id)) as BracketMatch;
        return m.position <= 2 ? "top" : "bottom";
      };
      expect(half("a1")).not.toBe(half("a2"));
    }
  });

  it("avança o vencedor e manda os perdedores das semifinais para o bronze", () => {
    let matches = generateSingleElimination(athletes(4).map((c, i) => ({ ...c, seed: i + 1 })));
    matches = recordResult(matches, "R1-M1", "a1");
    matches = recordResult(matches, "R1-M2", "a2");

    expect(byKey(matches, "R2-M1")).toMatchObject({ red: "a1", blue: "a2", status: "ready" });
    expect(byKey(matches, BRONZE_KEY)).toMatchObject({ red: "a4", blue: "a3", status: "ready" });
  });

  it("calcula o pódio com disputa de bronze", () => {
    const matches = playOut(generateSingleElimination(athletes(4).map((c, i) => ({ ...c, seed: i + 1 }))));
    expect(singleEliminationPlacements(matches)).toEqual([
      { competitorId: "a1", place: 1 },
      { competitorId: "a2", place: 2 },
      { competitorId: "a4", place: 3 },
      { competitorId: "a3", place: 4 },
    ]);
  });

  it("dá dois terceiros lugares quando não há disputa de bronze", () => {
    const matches = playOut(
      generateSingleElimination(
        athletes(4).map((c, i) => ({ ...c, seed: i + 1 })),
        { bronzeMatch: false },
      ),
    );
    expect(matches.some((m) => m.key === BRONZE_KEY)).toBe(false);
    expect(singleEliminationPlacements(matches).filter((p) => p.place === 3)).toHaveLength(2);
  });

  it("não cria bronze para 2 ou 3 competidores", () => {
    expect(generateSingleElimination(athletes(2)).some((m) => m.key === BRONZE_KEY)).toBe(false);
    const three = playOut(generateSingleElimination(athletes(3), { rng: fixedRng }));
    expect(three.some((m) => m.key === BRONZE_KEY)).toBe(false);
    expect(singleEliminationPlacements(three).map((p) => p.place)).toEqual([1, 2, 3]);
  });

  it("recusa resultado em luta que não está pronta ou com competidor de fora", () => {
    const matches = generateSingleElimination(athletes(4).map((c, i) => ({ ...c, seed: i + 1 })));
    expect(() => recordResult(matches, "R2-M1", "a1")).toThrow();
    expect(() => recordResult(matches, "R1-M1", "a2")).toThrow();
  });

  it("recusa chave com menos de 2 competidores", () => {
    expect(() => generateSingleElimination(athletes(1))).toThrow();
  });
});

describe("round robin", () => {
  it.each([
    [3, 3],
    [4, 6],
    [5, 10],
  ])("%i competidores geram %i lutas, cada par uma única vez", (n, expected) => {
    const matches = generateRoundRobin(athletes(n), fixedRng);
    expect(matches).toHaveLength(expected);
    const pairs = new Set(matches.map((m) => [m.red, m.blue].sort().join("-")));
    expect(pairs.size).toBe(expected);
  });

  it("ninguém luta duas vezes na mesma rodada", () => {
    const matches = generateRoundRobin(athletes(5), fixedRng);
    for (const round of new Set(matches.map((m) => m.round))) {
      const ids = matches.filter((m) => m.round === round).flatMap((m) => [m.red, m.blue]);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("classifica por vitórias e desempata dois atletas no confronto direto", () => {
    const strength: Record<string, number> = { a1: 4, a2: 3, a3: 2, a4: 1 };
    let matches = generateRoundRobin(athletes(4), fixedRng);
    for (const m of matches) {
      const winner = strength[m.red as string] > strength[m.blue as string] ? m.red : m.blue;
      matches = recordResult(matches, m.key, winner as string);
    }
    expect(roundRobinPlacements(matches)).toEqual([
      { competitorId: "a1", place: 1 },
      { competitorId: "a2", place: 2 },
      { competitorId: "a3", place: 3 },
      { competitorId: "a4", place: 4 },
    ]);
  });

  it("só classifica quando todas as lutas terminaram", () => {
    expect(roundRobinPlacements(generateRoundRobin(athletes(3), fixedRng))).toEqual([]);
  });
});
