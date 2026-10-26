import { describe, expect, it } from "vitest";
import {
  generateDoubleElimination,
  generateRoundRobin,
  generateSingleElimination,
  type BracketMatch,
  type Competitor,
} from "./brackets";
import { balanceDivisions, buildSchedule, type ScheduleBracketType, type ScheduleDivision } from "./schedule";

const fixedRng = () => 0.42;
const athletes = (n: number): Competitor[] => Array.from({ length: n }, (_, i) => ({ id: `a${i + 1}`, seed: i + 1 }));

function division(id: string, type: ScheduleBracketType, matches: BracketMatch[], matId: string | null = "mat1"): ScheduleDivision {
  return {
    id,
    matId,
    bracketType: type,
    matches: matches.map((m) => ({
      id: `${id}:${m.key}`,
      key: m.key,
      round: m.round,
      position: m.position,
      status: m.status.toUpperCase() as "PENDING" | "READY" | "BYE" | "FINISHED",
      nextKey: m.next?.key ?? null,
    })),
  };
}

/** Cada luta tem de vir depois das que lhe mandam atletas (vencedor ou perdedor). */
function expectFeedersFirst(prefix: string, matches: BracketMatch[], sequence: Map<string, number>) {
  for (const m of matches) {
    for (const link of [m.next, m.loserNext]) {
      if (!link || m.status === "bye") continue;
      const from = sequence.get(`${prefix}:${m.key}`);
      const to = sequence.get(`${prefix}:${link.key}`);
      if (from !== undefined && to !== undefined) expect(from).toBeLessThan(to);
    }
  }
}

const start = new Date("2026-11-20T09:00:00+01:00");

describe("programação", () => {
  it("dá a cada luta uma hora prevista, de x em x minutos, sem contar os byes", () => {
    const matches = generateSingleElimination(athletes(5), { rng: fixedRng });
    const slots = buildSchedule([{ id: "mat1", startsAt: start }], [division("d1", "SINGLE_ELIMINATION", matches)], 8);
    const real = matches.filter((m) => m.status !== "bye");
    expect(slots).toHaveLength(real.length);
    expect(slots.map((s) => s.sequence)).toEqual(real.map((_, i) => i + 1));
    expect(slots[1].scheduledAt!.getTime() - slots[0].scheduledAt!.getTime()).toBe(8 * 60_000);
  });

  it.each([
    ["SINGLE_ELIMINATION", generateSingleElimination(athletes(8), { rng: fixedRng })],
    ["DOUBLE_ELIMINATION", generateDoubleElimination(athletes(8), fixedRng)],
    ["DOUBLE_ELIMINATION", generateDoubleElimination(athletes(13), fixedRng)],
    ["ROUND_ROBIN", generateRoundRobin(athletes(5), fixedRng)],
  ] as const)("põe as lutas de uma chave %s depois das que as alimentam", (type, matches) => {
    const slots = buildSchedule([{ id: "mat1", startsAt: start }], [division("d1", type, matches)], 6);
    expectFeedersFirst("d1", matches, new Map(slots.map((s) => [s.matchId, s.sequence])));
  });

  it("deixa a final de eliminação simples para depois do bronze", () => {
    const matches = generateSingleElimination(athletes(8), { rng: fixedRng });
    const slots = buildSchedule([{ id: "mat1", startsAt: null }], [division("d1", "SINGLE_ELIMINATION", matches)], 8);
    expect(slots.at(-1)?.matchId).toBe("d1:R3-M1");
    expect(slots.at(-1)?.scheduledAt).toBeNull();
  });

  it("intercala as rondas das categorias da mesma área e deixa de fora as que não têm área", () => {
    const a = generateSingleElimination(athletes(4), { rng: fixedRng });
    const b = generateSingleElimination(athletes(4), { rng: fixedRng });
    const c = generateSingleElimination(athletes(4), { rng: fixedRng });
    const slots = buildSchedule(
      [{ id: "mat1", startsAt: start }],
      [division("a", "SINGLE_ELIMINATION", a), division("b", "SINGLE_ELIMINATION", b), division("c", "SINGLE_ELIMINATION", c, null)],
      8,
    );
    expect(slots.map((s) => s.matchId).slice(0, 4)).toEqual(["a:R1-M1", "a:R1-M2", "b:R1-M1", "b:R1-M2"]);
    expect(slots.some((s) => s.matchId.startsWith("c:"))).toBe(false);
  });

  it("reparte as categorias pelas áreas pelo número de lutas", () => {
    const assignment = balanceDivisions(
      ["m1", "m2"],
      [
        { id: "grande", matches: 15 },
        { id: "media", matches: 7 },
        { id: "pequena", matches: 3 },
        { id: "mini", matches: 3 },
      ],
    );
    expect(assignment.get("grande")).toBe("m1");
    expect(assignment.get("media")).toBe("m2");
    expect(assignment.get("pequena")).toBe("m2");
    expect(assignment.get("mini")).toBe("m2");
  });
});
