"use client";

import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { RotateCw } from "lucide-react";
import { useState } from "react";
import { NameWithBadge } from "@/components/trusted-lender-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AUTOMATION_LABELS } from "@/lib/automation-labels";
import { formatDay } from "@/lib/dates";
import { STATUS_TONES } from "@/lib/status-tones";
import { useToastAction } from "@/lib/use-toast-action";
import { api } from "../../../convex/_generated/api";
import {
  DELIVERY_STATUSES,
  type DeliveryStatus,
} from "../../../convex/lib/validators";
import { AutomationOutcomes } from "./automation-outcomes";
import { ADMIN_PAGE_SIZE, TableState } from "./table-state";

const ALL = "all";

const STATUS_TONE: Record<DeliveryStatus, string> = {
  failed: STATUS_TONES.bad,
  pending: STATUS_TONES.warn,
  sent: STATUS_TONES.good,
};
const FILTER_LABELS: Record<DeliveryStatus, string> = {
  failed: "Failed",
  pending: "Queued or retrying",
  sent: "Sent",
};

/** A pending delivery reads "Queued" before its first attempt, then "Retrying". */
function deliveryLabel(status: DeliveryStatus, attempts: number) {
  if (status === "pending") return attempts === 0 ? "Queued" : "Retrying";
  return FILTER_LABELS[status];
}

function DeliveryBadge({
  status,
  label,
}: {
  status: DeliveryStatus;
  label: string;
}) {
  return (
    <Badge className={STATUS_TONE[status]} variant="secondary">
      {label}
    </Badge>
  );
}

/** One click re-queues every failed delivery; the redrive drains in batches. */
function RetryFailed() {
  const failed = useQuery(api.admin.automationHealth)?.failed ?? 0;
  const retry = useMutation(api.admin.retryFailedNotifications);
  const { pending, run } = useToastAction();
  return (
    <Button
      disabled={pending || failed === 0}
      onClick={() =>
        run(
          () => retry({}),
          (count) =>
            count === 0
              ? "Nothing to retry: no failed notifications"
              : "Failed notifications queued again"
        )
      }
      size="sm"
      variant="outline"
    >
      <RotateCw aria-hidden />
      Retry failed
    </Button>
  );
}

function Notifications() {
  const [status, setStatus] = useState<DeliveryStatus | typeof ALL>(ALL);
  const rows = usePaginatedQuery(
    api.admin.listNotifications,
    { status: status === ALL ? undefined : status },
    { initialNumItems: ADMIN_PAGE_SIZE }
  );
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            Request notifications
          </h2>
          <p className="text-muted-foreground text-sm">
            Each loan event Convex signs and sends to n8n. Deliveries retry for
            about 20 minutes before they are marked failed.
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            onValueChange={(value) =>
              setStatus(value as DeliveryStatus | typeof ALL)
            }
            value={status}
          >
            <SelectTrigger
              aria-label="Filter by delivery status"
              className="w-40"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All deliveries</SelectItem>
              {DELIVERY_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {FILTER_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <RetryFailed />
        </div>
      </div>
      <TableState empty="No notifications match." query={rows}>
        {(page) => (
          <>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.map((row) => (
                <TableRow key={row._id}>
                  <TableCell className="font-medium">
                    {AUTOMATION_LABELS[row.event]}
                    {row.lastError ? (
                      <span className="text-destructive block max-w-xs truncate text-xs font-normal">
                        {row.lastError}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{row.toolName}</TableCell>
                  <TableCell>
                    <NameWithBadge
                      isTrustedLender={row.recipient.isTrustedLender}
                    >
                      {row.recipient.name}
                    </NameWithBadge>
                  </TableCell>
                  <TableCell>
                    <DeliveryBadge
                      label={deliveryLabel(row.status, row.attempts)}
                      status={row.status}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums">{row.attempts}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(row.sentAt ?? row._creationTime, {
                      addSuffix: true,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </>
        )}
      </TableState>
    </section>
  );
}

function Reminders() {
  const rows = usePaginatedQuery(
    api.admin.listReminders,
    {},
    { initialNumItems: ADMIN_PAGE_SIZE }
  );
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold">
          Overdue reminders
        </h2>
        <p className="text-muted-foreground text-sm">
          Written back by the hourly n8n runs (08:00–17:00 UTC), at most one per
          loan per day. There's nothing to retry by hand: a failed reminder is
          tried again at the next hourly run that day, and a new one goes out
          each day the loan stays overdue.
        </p>
      </div>
      <TableState empty="No reminders have been sent yet." query={rows}>
        {(page) => (
          <>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Borrower</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.map((row) => (
                <TableRow key={row._id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDay(row.reminderDate)}
                  </TableCell>
                  <TableCell className="font-medium">{row.toolName}</TableCell>
                  <TableCell>
                    <NameWithBadge
                      isTrustedLender={row.borrower.isTrustedLender}
                    >
                      {row.borrower.name}
                    </NameWithBadge>
                  </TableCell>
                  <TableCell>
                    <DeliveryBadge
                      label={FILTER_LABELS[row.status]}
                      status={row.status}
                    />
                    {row.error ? (
                      <span className="text-destructive block max-w-xs truncate text-xs">
                        {row.error}
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </>
        )}
      </TableState>
    </section>
  );
}

export function AdminAutomation() {
  return (
    <div className="space-y-10">
      <AutomationOutcomes />
      <Notifications />
      <Reminders />
    </div>
  );
}
