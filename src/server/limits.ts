import { headers } from "next/headers";
import { UserError } from "@/lib/errors";
import { rateLimit } from "./kv";

// Limites de pedidos por IP ou por utilizador, partilhados entre servidores através do kv.
// O IP vem de X-Forwarded-For: em produção a aplicação tem de estar atrás de um proxy ou
// balanceador que escreva esse cabeçalho (e apague o que vier do cliente).

export async function clientIp(): Promise<string> {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "local";
}

const MINUTE = 60_000;

export const LIMITS = {
  signup: { limit: 30, windowMs: 10 * MINUTE },
  login: { limit: 100, windowMs: 15 * MINUTE },
  registration: { limit: 30, windowMs: 10 * MINUTE },
  payment: { limit: 30, windowMs: 10 * MINUTE },
  // Impede adivinhar códigos de cupão por tentativa e erro.
  coupon: { limit: 20, windowMs: 10 * MINUTE },
} as const;

/** Lança um erro para o formulário quando a chave passou o limite da ação. */
export async function enforceLimit(action: keyof typeof LIMITS, key: string) {
  const { limit, windowMs } = LIMITS[action];
  const result = await rateLimit(`${action}:${key}`, limit, windowMs);
  if (!result.ok) {
    const minutes = Math.max(1, Math.ceil(result.retryAfterMs / MINUTE));
    throw new UserError(`Demasiados pedidos seguidos. Tente de novo dentro de ${minutes} min.`);
  }
}
