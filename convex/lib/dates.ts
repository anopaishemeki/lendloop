// Loan dates are UTC calendar days in ISO form (YYYY-MM-DD), so plain string
// comparison orders them correctly.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
export const DAY_MS = 86_400_000;

export type DateRange = { startDate: string; endDate: string };

/** Midnight UTC at the start of an ISO day, in milliseconds. */
export function dayStartMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function todayUtc(now = Date.now()): string {
  return toIsoDate(now);
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = dayStartMs(value);
  return !Number.isNaN(parsed) && toIsoDate(parsed) === value;
}

export function addDays(date: string, days: number): string {
  return toIsoDate(dayStartMs(date) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dayStartMs(to) - dayStartMs(from)) / DAY_MS);
}

/** Inclusive ranges: a loan ending on the 5th overlaps one starting on the 5th. */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}
