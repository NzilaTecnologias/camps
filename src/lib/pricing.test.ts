import { describe, expect, it } from "vitest";
import { computePrice, earlyDiscountActive, normalizeCouponCode } from "./pricing";

const now = new Date("2026-10-16T12:00:00Z");
const noEarly = { earlyDiscountPercent: null, earlyDiscountEndsAt: null };
const early = { earlyDiscountPercent: 20, earlyDiscountEndsAt: new Date("2026-10-20T23:59:59Z") };

describe("computePrice", () => {
  it("sem descontos fica o preço da categoria", () => {
    expect(computePrice(1_000_000, noEarly, null, now)).toEqual({
      baseCents: 1_000_000,
      priceCents: 1_000_000,
      discountCents: 0,
      applied: [],
    });
  });

  it("aplica o desconto antecipado só até à data", () => {
    expect(computePrice(1_000_000, early, null, now).priceCents).toBe(800_000);
    expect(computePrice(1_000_000, early, null, new Date("2026-10-21T00:00:00Z")).priceCents).toBe(1_000_000);
    expect(earlyDiscountActive({ earlyDiscountPercent: 0, earlyDiscountEndsAt: early.earlyDiscountEndsAt }, now)).toBe(false);
  });

  it("acumula o cupão percentual sobre o preço já com desconto antecipado", () => {
    const price = computePrice(1_000_000, early, { code: "ATLETA10", percentOff: 10, amountOffCents: null }, now);
    expect(price.priceCents).toBe(720_000);
    expect(price.discountCents).toBe(280_000);
    expect(price.applied.map((a) => a.label)).toEqual(["Desconto antecipado (20%)", "Cupão ATLETA10"]);
  });

  it("um cupão de valor fixo nunca deixa o preço negativo", () => {
    const price = computePrice(500_000, noEarly, { code: "GRATIS", percentOff: null, amountOffCents: 900_000 }, now);
    expect(price.priceCents).toBe(0);
    expect(price.discountCents).toBe(500_000);
  });
});

describe("normalizeCouponCode", () => {
  it("ignora maiúsculas e espaços", () => {
    expect(normalizeCouponCode("  atleta 10 ")).toBe("ATLETA10");
  });
});
