import { describe, expect, it } from "vitest";
import { SPORT_NAMES } from "./sports";
import { applyChange, penaltyWarning, rulesFor, validChange } from "./sport-rules";

const zero = { points: 0, advantages: 0, penalties: 0 };

describe("rulesFor", () => {
  it("todas as modalidades aceites têm regras coerentes", () => {
    for (const sport of SPORT_NAMES) {
      const rules = rulesFor(sport);
      expect(rules.durations).toContain(rules.defaultDuration);
      expect(rules.methods.length).toBeGreaterThan(2);
      expect(rules.points.steps.length).toBeGreaterThan(0);
    }
  });

  it("modalidade desconhecida usa as regras do jiu-jitsu", () => {
    expect(rulesFor("Capoeira").rulebook).toBe("IBJJF");
  });
});

describe("validChange", () => {
  it("só aceita os botões da modalidade ou −1", () => {
    expect(validChange(rulesFor("Jiu-Jitsu"), { field: "points", delta: 3 })).toBe(true);
    expect(validChange(rulesFor("Jiu-Jitsu"), { field: "points", delta: 1 })).toBe(false);
    expect(validChange(rulesFor("Taekwondo"), { field: "points", delta: 5 })).toBe(true);
    expect(validChange(rulesFor("Judo"), { field: "points", delta: -1 })).toBe(true);
    expect(validChange(rulesFor("Judo"), { field: "advantages", delta: 1 })).toBe(false);
  });
});

describe("applyChange", () => {
  it("gam-jeom no Taekwondo dá um ponto ao adversário, e tirá-lo retira-o", () => {
    const rules = rulesFor("Taekwondo");
    const given = applyChange(rules, zero, { ...zero, points: 4 }, { field: "penalties", delta: 1 });
    expect(given.self.penalties).toBe(1);
    expect(given.opponent.points).toBe(5);
    const undone = applyChange(rules, given.self, given.opponent, { field: "penalties", delta: -1 });
    expect(undone.opponent.points).toBe(4);
  });

  it("respeita os máximos e nunca desce abaixo de zero", () => {
    const karate = rulesFor("Karaté");
    const senshu = applyChange(karate, { ...zero, advantages: 1 }, zero, { field: "advantages", delta: 1 });
    expect(senshu.self.advantages).toBe(1);
    const judo = rulesFor("Judo");
    expect(applyChange(judo, zero, zero, { field: "points", delta: -1 }).self.points).toBe(0);
    // Tirar um gam-jeom que não existe não mexe nos pontos do adversário.
    const tkd = applyChange(rulesFor("Taekwondo"), zero, { ...zero, points: 3 }, { field: "penalties", delta: -1 });
    expect(tkd.opponent.points).toBe(3);
  });
});

describe("penaltyWarning", () => {
  it("avisa no terceiro shido do judo", () => {
    expect(penaltyWarning(rulesFor("Judo"), 2)).toBeNull();
    expect(penaltyWarning(rulesFor("Judo"), 3)).toMatch(/perde a luta/);
  });
});
