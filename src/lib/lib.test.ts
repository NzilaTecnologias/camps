import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { slugify } from "./slug";

describe("password", () => {
  it("aceita a senha certa e recusa a errada", async () => {
    const stored = await hashPassword("senha-secreta");
    expect(await verifyPassword("senha-secreta", stored)).toBe(true);
    expect(await verifyPassword("senha-errada", stored)).toBe(false);
  });

  it("gera hashes diferentes para a mesma senha", async () => {
    expect(await hashPassword("abc12345")).not.toBe(await hashPassword("abc12345"));
  });

  it("recusa hash armazenado em formato inválido", async () => {
    expect(await verifyPassword("qualquer", "!")).toBe(false);
    expect(await verifyPassword("qualquer", "scrypt$abc$def")).toBe(false);
  });
});

describe("slugify", () => {
  it("remove acentos, espaços e pontuação", () => {
    expect(slugify("Copa São Paulo de Jiu-Jitsu 2026!")).toBe("copa-sao-paulo-de-jiu-jitsu-2026");
    expect(slugify("  Liga   Camps  ")).toBe("liga-camps");
  });
});
