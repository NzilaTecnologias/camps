// Preço da Camps para os organizadores. Fica numa variável de ambiente para se poder ajustar
// sem mexer no código; cada evento grava o valor em vigor quando é criado.

const DEFAULT_FEE_KZ = 500;

/** Taxa por atleta confirmado, em cêntimos de kwanza (PLATFORM_FEE_PER_ATHLETE_KZ, por omissão 500 Kz). */
export function platformFeePerAthleteCents(): number {
  const kz = Number(process.env.PLATFORM_FEE_PER_ATHLETE_KZ);
  return Math.round((Number.isFinite(kz) && kz >= 0 ? kz : DEFAULT_FEE_KZ) * 100);
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
