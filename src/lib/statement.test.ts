import { describe, expect, it } from "vitest";
import { computeStatement, formatIban, normalizeAngolanIban } from "./statement";

describe("computeStatement", () => {
  it("desconta reembolsos, taxa por atleta e repasses já feitos", () => {
    const statement = computeStatement({
      collectedCents: 16 * 1_500_000,
      refundedCents: 1_500_000,
      athletes: 16,
      feePerAthleteCents: 50_000,
      paidOutCents: 10_000_000,
    });
    expect(statement.netCollectedCents).toBe(22_500_000);
    expect(statement.feeCents).toBe(800_000);
    expect(statement.balanceCents).toBe(22_500_000 - 800_000 - 10_000_000);
  });

  it("evento só com inscrições manuais ou gratuitas deixa o organizador a dever a taxa", () => {
    const statement = computeStatement({ collectedCents: 0, refundedCents: 0, athletes: 10, feePerAthleteCents: 50_000, paidOutCents: 0 });
    expect(statement.balanceCents).toBe(-500_000);
  });
});

describe("normalizeAngolanIban", () => {
  it("aceita um IBAN válido com espaços e minúsculas", () => {
    expect(normalizeAngolanIban("ao15 0040 0000 1234 5678 1017 4")).toBe("AO15004000001234567810174");
  });

  it("recusa dígitos de controlo errados, outros países e tamanhos errados", () => {
    expect(normalizeAngolanIban("AO16004000001234567810174")).toBeNull();
    expect(normalizeAngolanIban("PT50000201231234567890154")).toBeNull();
    expect(normalizeAngolanIban("AO150040")).toBeNull();
  });

  it("formata em grupos de 4", () => {
    expect(formatIban("AO15004000001234567810174")).toBe("AO15 0040 0000 1234 5678 1017 4");
  });
});
