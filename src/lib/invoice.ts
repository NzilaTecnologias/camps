// Contas das faturas da Camps. Os preços da Camps (taxa por atleta, Plano Federação) incluem IVA:
// o total é o preço, e o IVA sai de dentro dele.

export type InvoiceLine = { description: string; quantity: number; unitCents: number; totalCents: number };

export type InvoiceTotals = { netCents: number; vatCents: number; totalCents: number };

export function line(description: string, quantity: number, unitCents: number): InvoiceLine {
  return { description, quantity, unitCents, totalCents: quantity * unitCents };
}

/** IVA incluído no preço: líquido = total ÷ (1 + taxa), arredondado ao cêntimo. */
export function invoiceTotals(lines: InvoiceLine[], vatRateBp: number): InvoiceTotals {
  const totalCents = lines.reduce((sum, item) => sum + item.totalCents, 0);
  const netCents = Math.round((totalCents * 10_000) / (10_000 + vatRateBp));
  return { netCents, vatCents: totalCents - netCents, totalCents };
}

/** "FR CAMPS2026/12": tipo de documento (fatura-recibo: já está paga), série e número. */
export function invoiceNumber(series: string, number: number): string {
  return `FR ${series}/${number}`;
}

/**
 * NIF angolano: 10 dígitos para empresas; para pessoas, o número do BI (9 dígitos, 2 letras e
 * 3 dígitos). Devolve-o normalizado ou null se não tiver nenhum desses formatos.
 */
export function normalizeNif(raw: string): string | null {
  const value = raw.replace(/[\s.-]/g, "").toUpperCase();
  return /^\d{10}$/.test(value) || /^\d{9}[A-Z]{2}\d{3}$/.test(value) ? value : null;
}
