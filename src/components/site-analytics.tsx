"use client";

import type { BeforeSendEvent } from "@vercel/analytics";
import { Analytics } from "@vercel/analytics/next";

/**
 * Drops the query string before a page view leaves the browser: admin filter
 * URLs can carry search text such as a neighbor's name (?q=…), and page paths
 * alone are enough for traffic stats.
 */
function withoutQuery(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  url.search = "";
  return { ...event, url: url.toString() };
}

/** Vercel Web Analytics: cookieless page views, only on Vercel deployments. */
export function SiteAnalytics() {
  return <Analytics beforeSend={withoutQuery} />;
}
