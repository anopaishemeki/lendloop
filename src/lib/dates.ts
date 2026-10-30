import { format, parseISO } from "date-fns";
import { daysBetween } from "../../convex/lib/dates";

/** Calendar day in the viewer's locale, from the server's YYYY-MM-DD strings. */
export function formatDay(iso: string): string {
  return format(parseISO(iso), "EEE d MMM");
}

export function formatRange(startDate: string, endDate: string): string {
  return startDate === endDate
    ? formatDay(startDate)
    : `${formatDay(startDate)} – ${formatDay(endDate)}`;
}

/** Inclusive length of a loan, counted the same way the server validates it. */
export function formatDayCount(startDate: string, endDate: string): string {
  const days = daysBetween(startDate, endDate) + 1;
  return days === 1 ? "1 day" : `${days} days`;
}

/**
 * The viewer's local calendar day. The server accepts a start one day before
 * its UTC "today", so this is always a valid earliest pick.
 */
export function localTodayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}
