// Regras do Plano Federação que não dependem da base de dados (testáveis à parte).

export type FederationPlanName = "BASIC" | "PREMIUM";

export const PLAN_LABEL: Record<FederationPlanName, string> = { BASIC: "Básico", PREMIUM: "Premium" };

/** O que cada plano permite. O Premium inclui tudo o do Básico. */
export const PLAN_FEATURES: Record<FederationPlanName, string[]> = {
  BASIC: [
    "Página própria da federação (/f/…)",
    "Eventos dos organizadores associados",
    "Filiação de academias com validade",
    "Repasses das quotas para o IBAN da federação",
  ],
  PREMIUM: [
    "Tudo o do plano Básico",
    "Filiação individual de atletas, paga online",
    "Eventos que exigem filiação ativa",
    "Ranking nacional de atletas e academias",
    "Notícias na página da federação",
  ],
};

type PlanState = { plan: FederationPlanName | null; planExpiresAt: Date | null };

/** A federação tem um plano pago e ainda dentro da validade. */
export function planActive(federation: PlanState, now = new Date()): boolean {
  return federation.plan !== null && federation.planExpiresAt !== null && federation.planExpiresAt >= now;
}

export function premiumActive(federation: PlanState, now = new Date()): boolean {
  return planActive(federation, now) && federation.plan === "PREMIUM";
}

/** Pontos do ranking por lugar no pódio (critério IBJJF dos torneios normais: 9 / 3 / 1). */
export const RANKING_POINTS: Record<number, number> = { 1: 9, 2: 3, 3: 1 };

export function rankingPoints(place: number): number {
  return RANKING_POINTS[place] ?? 0;
}

/** Fim da validade de uma filiação: `months` meses depois do início, no fim desse dia. */
export function membershipValidUntil(start: Date, months: number): Date {
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + months);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/** Cor da marca: só #rrggbb, para poder ir direta para o CSS. */
export function normalizeColor(value: string): string | null {
  const color = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(color) ? color : null;
}
