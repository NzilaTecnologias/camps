import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Segredos das contas de pagamento das organizações e federações (token da ProxyPay, segredo do
// PayPal). Ficam na base de dados cifrados com AES-256-GCM e a chave PAYMENT_SECRETS_KEY, que só
// existe no servidor: uma cópia da base de dados não chega para cobrar em nome de ninguém.
// Formato guardado: "v1:" + base64(iv de 12 bytes | etiqueta de 16 bytes | texto cifrado).

const VERSION = "v1:";
// Só para desenvolvimento e testes: em produção o servidor não arranca sem PAYMENT_SECRETS_KEY
// (server/env-check.ts).
const DEV_KEY = createHash("sha256").update("camps-dev-only-payment-secrets").digest();

function key(): Buffer {
  const value = process.env.PAYMENT_SECRETS_KEY;
  if (!value) {
    if (process.env.NODE_ENV === "production") throw new Error("PAYMENT_SECRETS_KEY em falta");
    return DEV_KEY;
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) throw new Error("PAYMENT_SECRETS_KEY tem de ter 32 bytes em base64");
  return decoded;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return VERSION + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith(VERSION)) throw new Error("Segredo num formato desconhecido");
  const raw = Buffer.from(stored.slice(VERSION.length), "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
