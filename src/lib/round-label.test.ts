import { describe, expect, it } from "vitest";
import { roundLabel } from "./round-label";

describe("roundLabel", () => {
  it("conta as rondas da eliminação simples a partir da final", () => {
    expect(roundLabel("SINGLE_ELIMINATION", { key: "R4-M1", round: 4 }, 4)).toBe("Final");
    expect(roundLabel("SINGLE_ELIMINATION", { key: "R3-M2", round: 3 }, 4)).toBe("Semifinal");
    expect(roundLabel("SINGLE_ELIMINATION", { key: "R2-M1", round: 2 }, 4)).toBe("Quartos de final");
    expect(roundLabel("SINGLE_ELIMINATION", { key: "R1-M5", round: 1 }, 4)).toBe("Oitavos de final");
    expect(roundLabel("SINGLE_ELIMINATION", { key: "R1-M5", round: 1 }, 6)).toBe("Ronda 1");
    expect(roundLabel("SINGLE_ELIMINATION", { key: "BRONZE", round: 4 }, 4)).toBe("Disputa de 3.º lugar");
  });

  it("distingue a chave principal, a dos vencidos e a final na dupla eliminação", () => {
    expect(roundLabel("DOUBLE_ELIMINATION", { key: "W3-M1", round: 3 }, 3)).toBe("Final da chave principal");
    expect(roundLabel("DOUBLE_ELIMINATION", { key: "W2-M1", round: 2 }, 3)).toBe("Semifinal");
    expect(roundLabel("DOUBLE_ELIMINATION", { key: "L2-M1", round: 2 }, 3)).toBe("Chave dos vencidos · ronda 2");
    expect(roundLabel("DOUBLE_ELIMINATION", { key: "GF", round: 4 }, 3)).toBe("Final");
  });

  it("todos contra todos usa o número da ronda", () => {
    expect(roundLabel("ROUND_ROBIN", { key: "RR2-M1", round: 2 }, 3)).toBe("Ronda 2");
  });
});
