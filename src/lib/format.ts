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

/** Ano, mês e dia de uma data no fuso de Luanda. */
function localDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date)
    .reduce<Record<string, number>>((acc, part) => (part.type === "literal" ? acc : { ...acc, [part.type]: Number(part.value) }), {});
  return { year: parts.year, month: parts.month, day: parts.day };
}

/** Dias de calendário (em Luanda) entre duas datas: 0 = mesmo dia, 1 = amanhã. */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = localDay(from);
  const b = localDay(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}

/** "14 nov", "17 – 24 out", "30 out – 2 nov"; com o ano quando não é o ano corrente. */
export function formatDateRange(start: Date, end: Date, now = new Date()): string {
  const s = localDay(start);
  const e = localDay(end);
  const month = (date: Date) =>
    new Intl.DateTimeFormat(LOCALE, { month: "short", timeZone: TIME_ZONE }).format(date).replace(".", "");
  const year = e.year !== localDay(now).year ? ` ${e.year}` : "";
  if (s.year === e.year && s.month === e.month && s.day === e.day) return `${s.day} ${month(start)}${year}`;
  if (s.year === e.year && s.month === e.month) return `${s.day} – ${e.day} ${month(end)}${year}`;
  return `${s.day} ${month(start)} – ${e.day} ${month(end)}${year}`;
}
