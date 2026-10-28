// Créditos da Camps, como no Smoothcomp: 1 crédito = 1 atleta confirmado num evento (conta uma
// vez por evento, seja em quantas categorias for). A organização compra-os antes; os pacotes
// maiores saem mais baratos. Sem créditos para todos os atletas confirmados, a gestão do evento
// (chaves, programação, placar) fica parada até comprar os que faltam.

/** Créditos oferecidos a cada organização nova, bloqueados até à primeira compra (de MIN_PURCHASE ou mais). */
export const WELCOME_CREDITS = 20;

/** Pacotes, com o desconto sobre o preço avulso. */
export const CREDIT_PACKS = [
  { credits: 100, discountPercent: 10 },
  { credits: 500, discountPercent: 20 },
  { credits: 1000, discountPercent: 30 },
] as const;

export const MIN_PURCHASE = 50;
export const MAX_PURCHASE = 20_000;

export type CreditQuote = { credits: number; unitCents: number; amountCents: number; discountPercent: number };

/** Preço de uma compra: o desconto do maior pacote que a quantidade atinge. */
export function quoteCredits(credits: number, baseUnitCents: number): CreditQuote {
  const pack = [...CREDIT_PACKS].reverse().find((p) => credits >= p.credits);
  const discountPercent = pack?.discountPercent ?? 0;
  const unitCents = Math.round((baseUnitCents * (100 - discountPercent)) / 100);
  return { credits, unitCents, amountCents: unitCents * credits, discountPercent };
}

/** Lê a quantidade escrita na compra; null se não for válida. */
export function parseCreditAmount(value: string): number | null {
  const credits = Number(value.replace(/\s/g, ""));
  return Number.isInteger(credits) && credits >= MIN_PURCHASE && credits <= MAX_PURCHASE ? credits : null;
}
