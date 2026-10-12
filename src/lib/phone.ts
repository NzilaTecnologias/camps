/**
 * Normaliza um número de telemóvel angolano para os 9 dígitos nacionais ("923456789").
 * Aceita espaços, traços e o indicativo +244 / 00244. Devolve null se não for um telemóvel válido.
 */
export function normalizeAngolanMobile(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00244")) digits = digits.slice(5);
  else if (digits.startsWith("244") && digits.length === 12) digits = digits.slice(3);
  return /^9\d{8}$/.test(digits) ? digits : null;
}
