import { describe, expect, it } from "vitest";
import { parseCreditAmount, quoteCredits } from "./credits";

const BASE = 100_000; // 1000 Kz em cêntimos

describe("preço dos créditos", () => {
  it("avulso custa o preço base", () => {
    expect(quoteCredits(50, BASE)).toEqual({ credits: 50, unitCents: 100_000, amountCents: 5_000_000, discountPercent: 0 });
  });

  it("os pacotes saem a 900, 800 e 700 Kz com a base de 1000 Kz", () => {
    expect(quoteCredits(100, BASE).unitCents).toBe(90_000);
    expect(quoteCredits(500, BASE).unitCents).toBe(80_000);
    expect(quoteCredits(1000, BASE).unitCents).toBe(70_000);
    expect(quoteCredits(1000, BASE).amountCents).toBe(70_000_000);
  });

  it("uma quantidade entre pacotes tem o desconto do pacote que já atingiu", () => {
    expect(quoteCredits(99, BASE).discountPercent).toBe(0);
    expect(quoteCredits(250, BASE).discountPercent).toBe(10);
    expect(quoteCredits(3000, BASE).discountPercent).toBe(30);
  });

  it("os descontos acompanham o preço base", () => {
    expect(quoteCredits(500, 50_000).unitCents).toBe(40_000);
  });

  it("aceita de 50 a 20 000 créditos inteiros", () => {
    expect(parseCreditAmount("50")).toBe(50);
    expect(parseCreditAmount("1 000")).toBe(1000);
    expect(parseCreditAmount("49")).toBeNull();
    expect(parseCreditAmount("12,5")).toBeNull();
    expect(parseCreditAmount("50000")).toBeNull();
  });
});
