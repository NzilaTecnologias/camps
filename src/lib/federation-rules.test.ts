import { describe, expect, it } from "vitest";
import { extendPlan, membershipValidUntil, normalizeColor, planActive, premiumActive, rankingPoints } from "./federation-rules";

const now = new Date("2026-10-20T12:00:00Z");

describe("planos da federação", () => {
  it("só conta como ativo com plano e validade no futuro", () => {
    expect(planActive({ plan: "BASIC", planExpiresAt: new Date("2027-01-01") }, now)).toBe(true);
    expect(planActive({ plan: "BASIC", planExpiresAt: new Date("2026-01-01") }, now)).toBe(false);
    expect(planActive({ plan: null, planExpiresAt: new Date("2027-01-01") }, now)).toBe(false);
    expect(premiumActive({ plan: "BASIC", planExpiresAt: new Date("2027-01-01") }, now)).toBe(false);
    expect(premiumActive({ plan: "PREMIUM", planExpiresAt: new Date("2027-01-01") }, now)).toBe(true);
  });
});

describe("regras de filiação e ranking", () => {
  it("pontua só o pódio: 9 / 3 / 1", () => {
    expect([1, 2, 3, 4].map(rankingPoints)).toEqual([9, 3, 1, 0]);
  });

  it("uma filiação de 12 meses acaba no fim do mesmo dia um ano depois", () => {
    expect(membershipValidUntil(now, 12).toISOString()).toBe("2027-10-20T23:59:59.999Z");
  });

  it("aceita só cores #rrggbb", () => {
    expect(normalizeColor(" #1A2B3C ")).toBe("#1a2b3c");
    expect(normalizeColor("red")).toBeNull();
    expect(normalizeColor("#fff;background:url(x)")).toBeNull();
  });
});

describe("extendPlan", () => {
  const now = new Date("2026-10-21T10:00:00Z");

  it("sem plano em dia, conta a partir de hoje", () => {
    const next = extendPlan({ plan: null, planExpiresAt: null }, "BASIC", 12, now);
    expect(next.plan).toBe("BASIC");
    expect(next.planExpiresAt.toISOString()).toBe("2027-10-21T23:59:59.999Z");
  });

  it("renovar antes do fim soma ao que faltava", () => {
    const current = { plan: "BASIC" as const, planExpiresAt: new Date("2027-01-31T23:59:59.999Z") };
    const next = extendPlan(current, "PREMIUM", 12, now);
    expect(next.plan).toBe("PREMIUM");
    expect(next.planExpiresAt.toISOString()).toBe("2028-01-31T23:59:59.999Z");
  });
});
