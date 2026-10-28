// Preços da Camps. Ficam em variáveis de ambiente para se poderem ajustar sem mexer no código.

const DEFAULT_CREDIT_KZ = 1000;

/**
 * Preço de um crédito avulso (1 atleta confirmado num evento), em cêntimos de kwanza:
 * CREDIT_PRICE_KZ, por omissão 1000 Kz. Os pacotes saem com desconto sobre este (lib/credits.ts).
 */
export function creditPriceCents(): number {
  const raw = process.env.CREDIT_PRICE_KZ;
  const kz = Number(raw);
  return Math.round((raw && Number.isFinite(kz) && kz > 0 ? kz : DEFAULT_CREDIT_KZ) * 100);
}

/** E-mails (separados por vírgulas) que são sempre administradores da área /admin (src/server/admin/session.ts). */
export function isPlatformAdmin(email: string): boolean {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

const DEFAULT_FEDERATION_KZ = { BASIC: 150_000, PREMIUM: 450_000 } as const;

/** Preço anual do Plano Federação, em cêntimos (FEDERATION_BASIC_KZ / FEDERATION_PREMIUM_KZ). */
export function federationPlanPriceCents(plan: "BASIC" | "PREMIUM"): number {
  const kz = Number(process.env[`FEDERATION_${plan}_KZ`]);
  return Math.round((Number.isFinite(kz) && kz >= 0 && process.env[`FEDERATION_${plan}_KZ`] ? kz : DEFAULT_FEDERATION_KZ[plan]) * 100);
}
