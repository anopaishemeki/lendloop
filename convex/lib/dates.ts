// Loan dates are UTC calendar days in ISO form (YYYY-MM-DD), so plain string
// comparison orders them correctly.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const DAY_MS = 86_400_000;

export type DateRange = { startDate: string; endDate: string };

export function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function todayUtc(now = Date.now()): string {
  return toIsoDate(now);
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed) && toIsoDate(parsed) === value;
}

export function addDays(date: string, days: number): string {
  return toIsoDate(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS
  );
}

/** Inclusive ranges: a loan ending on the 5th overlaps one starting on the 5th. */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}
