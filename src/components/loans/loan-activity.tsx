import { formatDistanceToNow } from "date-fns";
import { BellRing, CircleAlert, Clock, Mail } from "lucide-react";
import type { Activity } from "../../../convex/lib/activity";

const LABELS: Record<Activity["kind"], string> = {
  "loan.returned": "Return confirmation",
  "overdue.reminder": "Overdue reminder",
  "request.approved": "Approval email",
  "request.cancelled": "Cancellation email",
  "request.created": "New request email",
  "request.declined": "Decline email",
};

function describe(item: Activity, otherName: string) {
  const what = LABELS[item.kind];
  const who = item.toViewer ? "you" : otherName;
  const when = formatDistanceToNow(item.at, { addSuffix: true });
  if (item.status === "sent") return `${what} sent to ${who} ${when}`;
  if (item.status === "failed") return `${what} to ${who} could not be sent`;
  return `${what} to ${who} is on its way`;
}

function Icon({ item }: { item: Activity }) {
  const className = "size-3.5 shrink-0";
  if (item.status === "failed") {
    return (
      <CircleAlert aria-hidden className={`${className} text-destructive`} />
    );
  }
  if (item.status === "pending")
    return <Clock aria-hidden className={className} />;
  return item.kind === "overdue.reminder" ? (
    <BellRing aria-hidden className={className} />
  ) : (
    <Mail aria-hidden className={className} />
  );
}

/** Recent automation for a loan, e.g. "Overdue reminder sent to Ben 2 days ago". */
export function LoanActivity({
  activity,
  otherName,
}: {
  activity: Activity[];
  otherName: string;
}) {
  if (activity.length === 0) return null;
  return (
    <ul aria-label="Recent activity" className="space-y-1 pt-1">
      {activity.map((item) => (
        <li
          className="text-muted-foreground flex items-center gap-1.5 text-xs"
          key={`${item.kind}-${item.at}`}
        >
          <Icon item={item} />
          {describe(item, otherName)}
        </li>
      ))}
    </ul>
  );
}
