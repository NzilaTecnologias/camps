// A plataforma opera em Angola: um só fuso (WAT, sem horário de verão), kwanza e português.
export const LOCALE = "pt-AO";
export const TIME_ZONE = "Africa/Luanda";
export const UTC_OFFSET = "+01:00";
export const DEFAULT_COUNTRY = "AO";

// Criar um Intl.DateTimeFormat / NumberFormat custa ~80 vezes mais do que usá-lo, e uma lista
// de 24 eventos formata dezenas de datas. Cada combinação de opções é criada uma só vez.
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const numberFormats = new Map<string, Intl.NumberFormat>();

export function dateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) dateFormats.set(key, (format = new Intl.DateTimeFormat(locale, options)));
  return format;
}

function numberFormat(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(options);
  let format = numberFormats.get(key);
  if (!format) numberFormats.set(key, (format = new Intl.NumberFormat(LOCALE, options)));
  return format;
}

export function formatMoney(cents: number, currency: string) {
  return numberFormat({ style: "currency", currency }).format(cents / 100);
}

export function formatDate(date: Date) {
  return dateFormat(LOCALE, { dateStyle: "long", timeZone: TIME_ZONE }).format(date);
}

/** "16/10/26, 14:30" no fuso de Luanda. */
export function formatDateTime(date: Date) {
  return dateFormat(LOCALE, { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE }).format(date);
}

/** "14:30" no fuso de Luanda. */
export function formatTime(date: Date) {
  // h23: meia-noite é 00:00 (com hour12: false alguns motores escrevem 24:00).
  return dateFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TIME_ZONE }).format(date);
}

/** Valor de um <input type="datetime-local"> no fuso de Luanda: "2026-11-20T09:00". */
export function toDateTimeInput(date: Date | null): string {
  return date ? `${toDateInput(date)}T${formatTime(date)}` : "";
}

/** Lê um <input type="datetime-local"> como hora de Luanda; nulo se não for válido. */
export function parseDateTimeInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00${UTC_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const EVENT_STATUS_LABEL = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  CANCELLED: "Cancelado",
} as const;

export const BRACKET_TYPE_LABEL = {
  SINGLE_ELIMINATION: "Eliminação simples",
  DOUBLE_ELIMINATION: "Dupla eliminação",
  ROUND_ROBIN: "Todos contra todos",
} as const;

export const REGISTRATION_STATUS_LABEL = {
  INCOMPLETE: "Por pagar",
  PAID: "Confirmada",
  CANCELLED: "Cancelada",
} as const;

const shortMonth = (date: Date) =>
  dateFormat(LOCALE, { month: "short", timeZone: TIME_ZONE }).format(date).replace(".", "");

/** Dia e mês separados, para o bloco de data dos cartões de evento. */
export function dateParts(date: Date) {
  return {
    day: dateFormat(LOCALE, { day: "2-digit", timeZone: TIME_ZONE }).format(date),
    month: shortMonth(date),
    year: dateFormat(LOCALE, { year: "numeric", timeZone: TIME_ZONE }).format(date),
  };
}

export function formatWeight(maxWeightKg: { toString(): string } | null) {
  return maxWeightKg ? `até ${maxWeightKg.toString()} kg` : "sem limite de peso";
}

/** "1 inscrito", "8 inscritos". */
export function count(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

const isoDay = () => dateFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** Ano, mês e dia de uma data no fuso de Luanda. */
function localDay(date: Date) {
  const [year, month, day] = isoDay().format(date).split("-").map(Number);
  return { year, month, day };
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
  const year = e.year !== localDay(now).year ? ` ${e.year}` : "";
  if (s.year === e.year && s.month === e.month && s.day === e.day) return `${s.day} ${shortMonth(start)}${year}`;
  if (s.year === e.year && s.month === e.month) return `${s.day} – ${e.day} ${shortMonth(end)}${year}`;
  return `${s.day} ${shortMonth(start)} – ${e.day} ${shortMonth(end)}${year}`;
}

/** Data no formato dos campos `<input type="date">` (AAAA-MM-DD), no fuso de Luanda. */
export function toDateInput(date: Date | null): string {
  return date ? isoDay().format(date) : "";
}

/** Peso medido na pesagem: "72,4 kg". */
export function formatKg(weightKg: { toString(): string }) {
  return `${numberFormat({ maximumFractionDigits: 2 }).format(Number(weightKg.toString()))} kg`;
}
