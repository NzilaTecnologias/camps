// Preço de uma inscrição: preço da categoria, menos o desconto antecipado do evento, menos o cupão.
// Os descontos acumulam por esta ordem e o preço nunca fica negativo.

export type EarlyDiscount = { earlyDiscountPercent: number | null; earlyDiscountEndsAt: Date | null };
export type CouponDiscount = { code: string; percentOff: number | null; amountOffCents: number | null };

export type Price = {
  baseCents: number;
  priceCents: number;
  discountCents: number;
  /** Descrição de cada desconto aplicado, para mostrar no resumo. */
  applied: { label: string; cents: number }[];
};

/** O desconto antecipado está a valer neste instante? */
export function earlyDiscountActive(event: EarlyDiscount, now = new Date()): boolean {
  return (
    event.earlyDiscountPercent !== null &&
    event.earlyDiscountPercent > 0 &&
    event.earlyDiscountEndsAt !== null &&
    now <= event.earlyDiscountEndsAt
  );
}

export function computePrice(
  baseCents: number,
  event: EarlyDiscount,
  coupon: CouponDiscount | null,
  now = new Date(),
): Price {
  let price = baseCents;
  const applied: Price["applied"] = [];

  if (earlyDiscountActive(event, now)) {
    const cents = Math.min(price, Math.round((baseCents * event.earlyDiscountPercent!) / 100));
    if (cents > 0) applied.push({ label: `Desconto antecipado (${event.earlyDiscountPercent}%)`, cents });
    price -= cents;
  }

  if (coupon) {
    const raw = coupon.percentOff ? Math.round((price * coupon.percentOff) / 100) : (coupon.amountOffCents ?? 0);
    const cents = Math.min(price, raw);
    if (cents > 0) applied.push({ label: `Cupão ${coupon.code}`, cents });
    price -= cents;
  }

  return { baseCents, priceCents: price, discountCents: baseCents - price, applied };
}

/** Códigos de cupão: letras, números e hífen, comparados sem diferença de maiúsculas. */
export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export const COUPON_CODE = /^[A-Z0-9-]{3,30}$/;
