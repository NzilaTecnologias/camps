// A plataforma opera em Angola: um só fuso (WAT, sem horário de verão), kwanza e português.
export const LOCALE = "pt-AO";
export const TIME_ZONE = "Africa/Luanda";
export const UTC_OFFSET = "+01:00";
export const DEFAULT_COUNTRY = "AO";

export function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format(cents / 100);
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "long", timeZone: TIME_ZONE }).format(date);
}

export const EVENT_STATUS_LABEL = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  CANCELLED: "Cancelado",
} as const;

export const BRACKET_TYPE_LABEL = {
  SINGLE_ELIMINATION: "Eliminação simples",
  ROUND_ROBIN: "Todos contra todos",
} as const;

export const REGISTRATION_STATUS_LABEL = {
  INCOMPLETE: "Por pagar",
  PAID: "Confirmada",
  CANCELLED: "Cancelada",
} as const;

/** Dia e mês separados, para o bloco de data dos cartões de evento. */
export function dateParts(date: Date) {
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: TIME_ZONE }).format(date);
  return { day: part({ day: "2-digit" }), month: part({ month: "short" }).replace(".", ""), year: part({ year: "numeric" }) };
}

export function formatWeight(maxWeightKg: { toString(): string } | null) {
  return maxWeightKg ? `até ${maxWeightKg.toString()} kg` : "sem limite de peso";
}

/** "1 inscrito", "8 inscritos". */
export function count(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}
