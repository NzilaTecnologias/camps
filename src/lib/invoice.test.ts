import { describe, expect, it } from "vitest";
import { invoiceNumber, invoiceTotals, line, normalizeNif } from "./invoice";

describe("invoiceTotals", () => {
  it("tira o IVA de dentro do preço", () => {
    // 16 atletas × 500 Kz = 8 000 Kz com IVA a 14 %: 7 017,54 + 982,46.
    const totals = invoiceTotals([line("Taxa", 16, 50_000)], 1400);
    expect(totals).toEqual({ netCents: 701_754, vatCents: 98_246, totalCents: 800_000 });
  });

  it("sem IVA, o líquido é o total", () => {
    expect(invoiceTotals([line("Plano", 1, 15_000_000)], 0)).toEqual({ netCents: 15_000_000, vatCents: 0, totalCents: 15_000_000 });
  });

  it("soma várias linhas", () => {
    expect(invoiceTotals([line("A", 2, 100), line("B", 1, 300)], 0).totalCents).toBe(500);
  });
});

describe("invoiceNumber", () => {
  it("junta tipo, série e número", () => {
    expect(invoiceNumber("CAMPS2026", 12)).toBe("FR CAMPS2026/12");
  });
});

describe("normalizeNif", () => {
  it("aceita NIF de empresa e número do BI", () => {
    expect(normalizeNif("5417 123 456")).toBe("5417123456");
    expect(normalizeNif("004567890la042")).toBe("004567890LA042");
  });

  it("recusa o resto", () => {
    expect(normalizeNif("12345")).toBeNull();
    expect(normalizeNif("ABCDEFGHIJ")).toBeNull();
  });
});
