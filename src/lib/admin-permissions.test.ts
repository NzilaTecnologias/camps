import { describe, expect, it } from "vitest";
import { can } from "./admin-permissions";

describe("can", () => {
  it("administrador pode tudo", () => {
    for (const permission of ["dashboard", "users", "finance", "staff", "audit", "system", "events.moderate"] as const) {
      expect(can("ADMIN", permission)).toBe(true);
    }
  });

  it("financeiro trata do dinheiro mas não das contas nem da equipa", () => {
    expect(can("FINANCE", "finance")).toBe(true);
    expect(can("FINANCE", "payments")).toBe(true);
    expect(can("FINANCE", "users")).toBe(false);
    expect(can("FINANCE", "staff")).toBe(false);
    expect(can("FINANCE", "events.moderate")).toBe(false);
  });

  it("suporte trata das contas e dos eventos mas não do dinheiro", () => {
    expect(can("SUPPORT", "users")).toBe(true);
    expect(can("SUPPORT", "events.moderate")).toBe(true);
    expect(can("SUPPORT", "emails")).toBe(true);
    expect(can("SUPPORT", "finance")).toBe(false);
    expect(can("SUPPORT", "audit")).toBe(false);
  });
});
