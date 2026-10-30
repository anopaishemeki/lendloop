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

/**
 * The viewer's local calendar day. The server accepts a start one day before
 * its UTC "today", so this is always a valid earliest pick.
 */
export function localTodayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}
