import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret } from "./secrets";

afterEach(() => vi.unstubAllEnvs());

describe("segredos das contas de pagamento", () => {
  it("cifra e decifra, e o texto guardado não contém o segredo", () => {
    vi.stubEnv("PAYMENT_SECRETS_KEY", randomBytes(32).toString("base64"));
    const stored = encryptSecret("token-proxypay-123");
    expect(stored.startsWith("v1:")).toBe(true);
    expect(stored).not.toContain("token-proxypay-123");
    expect(decryptSecret(stored)).toBe("token-proxypay-123");
  });

  it("cada cifra é diferente, mesmo para o mesmo segredo", () => {
    expect(encryptSecret("igual")).not.toBe(encryptSecret("igual"));
  });

  it("outra chave ou um texto alterado não decifram", () => {
    vi.stubEnv("PAYMENT_SECRETS_KEY", randomBytes(32).toString("base64"));
    const stored = encryptSecret("segredo");
    const tampered = stored.slice(0, -4) + (stored.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(() => decryptSecret(tampered)).toThrow();
    vi.stubEnv("PAYMENT_SECRETS_KEY", randomBytes(32).toString("base64"));
    expect(() => decryptSecret(stored)).toThrow();
  });

  it("recusa uma chave com o tamanho errado", () => {
    vi.stubEnv("PAYMENT_SECRETS_KEY", Buffer.from("curta").toString("base64"));
    expect(() => encryptSecret("x")).toThrow("32 bytes");
  });
});
