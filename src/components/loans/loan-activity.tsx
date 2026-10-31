"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { formatDistanceToNow } from "date-fns";
import { BellRing, CircleAlert, Clock, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { AUTOMATION_LABELS } from "@/lib/automation-labels";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Activity = FunctionReturnType<typeof api.loans.activity>[number];

const MINUTE_MS = 60_000;

function describe(item: Activity, otherName: string, now: number) {
  const what = AUTOMATION_LABELS[item.kind];
  const who = item.toViewer ? "you" : otherName;
  const when = formatDistanceToNow(item.at, { addSuffix: true });
  if (item.status === "sent") return `${what} sent to ${who} ${when}`;
  if (item.status === "failed") {
    return `${what} to ${who} could not be sent (${when})`;
  }
  return item.at > now - MINUTE_MS
    ? `${what} to ${who} is on its way`
    : `${what} to ${who} is being retried`;
}

function Icon({ item }: { item: Activity }) {
  const className = "size-3.5 shrink-0";
  if (item.status === "failed") {
    return (
      <CircleAlert aria-hidden className={`${className} text-destructive`} />
    );
  }
  if (item.status === "pending") {
    return <Clock aria-hidden className={className} />;
  }
  return item.kind === "overdue.reminder" ? (
    <BellRing aria-hidden className={className} />
  ) : (
    <Mail aria-hidden className={className} />
  );
}

/** Re-renders every minute so "2 minutes ago" doesn't go stale on an open page. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Recent automation for a loan, e.g. "Overdue reminder sent to Ben 2 days ago". */
export function LoanActivity({
  loanId,
  otherName,
}: {
  loanId: Id<"loans">;
  otherName: string;
}) {
  const activity = useQuery(api.loans.activity, { loanId });
  const now = useNow();
  if (!activity?.length) return null;
  return (
    <ul aria-label="Recent activity" className="space-y-1 pt-1">
      {activity.map((item) => (
        <li
          className="text-muted-foreground flex items-center gap-1.5 text-xs"
          key={item.id}
        >
          <Icon item={item} />
          {describe(item, otherName, now)}
        </li>
      ))}
    </ul>
  );
}
