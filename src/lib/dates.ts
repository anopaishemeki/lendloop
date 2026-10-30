import { format, parseISO } from "date-fns";

/** Calendar day in the viewer's locale, from the server's YYYY-MM-DD strings. */
export function formatDay(iso: string): string {
  return format(parseISO(iso), "EEE d MMM");
}

export function formatRange(startDate: string, endDate: string): string {
  return startDate === endDate
    ? formatDay(startDate)
    : `${formatDay(startDate)} – ${formatDay(endDate)}`;
}

/** Today as YYYY-MM-DD in UTC, matching how the server compares loan dates. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
