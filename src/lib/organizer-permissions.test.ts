import { describe, expect, it } from "vitest";
import { canOrganizer, rolesWith } from "./organizer-permissions";

describe("canOrganizer", () => {
  it("o dono pode tudo", () => {
    for (const permission of ["view", "floor", "event", "money", "payout", "team"] as const) {
      expect(canOrganizer("OWNER", permission)).toBe(true);
    }
  });

  it("o gestor gere os eventos e os reembolsos, mas não a equipa nem a conta de pagamentos", () => {
    expect(canOrganizer("ADMIN", "event")).toBe(true);
    expect(canOrganizer("ADMIN", "money")).toBe(true);
    expect(canOrganizer("ADMIN", "payout")).toBe(false);
    expect(canOrganizer("ADMIN", "team")).toBe(false);
  });

  it("o mesário só trabalha no dia da prova", () => {
    expect(canOrganizer("STAFF", "view")).toBe(true);
    expect(canOrganizer("STAFF", "floor")).toBe(true);
    expect(canOrganizer("STAFF", "event")).toBe(false);
    expect(canOrganizer("STAFF", "money")).toBe(false);
  });

  it("quem não está na equipa não pode nada", () => {
    expect(canOrganizer(null, "view")).toBe(false);
    expect(rolesWith("team")).toEqual(["OWNER"]);
  });
});
