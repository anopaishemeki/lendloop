// Loan dates are UTC calendar days in ISO form (YYYY-MM-DD), so plain string
// comparison orders them correctly.

const DAY_MS = 86_400_000;

export function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function todayUtc(now = Date.now()): string {
  return toIsoDate(now);
}

export function addDays(date: string, days: number): string {
  return toIsoDate(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS);
}
