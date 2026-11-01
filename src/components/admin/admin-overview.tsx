"use client";

import { useQuery } from "convex/react";
import {
  AlarmClock,
  BadgeCheck,
  CircleAlert,
  Flag,
  Hourglass,
  type LucideIcon,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { loanStatusLabel } from "@/components/loans/loan-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import { LOAN_STATUSES } from "../../../convex/lib/validators";
import { LatestLoans } from "./admin-loans";

type Tone = "default" | "warn" | "bad";

function StatCard({
  href,
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <Link
      className="surface group hover:border-primary/40 flex flex-col gap-3 p-5 transition-colors"
      href={href}
    >
      <span
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-lg",
          tone === "default" && "bg-secondary text-secondary-foreground",
          tone === "warn" && "bg-accent text-accent-foreground",
          tone === "bad" && "bg-destructive/10 text-destructive"
        )}
      >
        <Icon aria-hidden className="size-4.5" />
      </span>
      <span className="font-display text-3xl font-semibold tabular-nums">
        {value}
      </span>
      <span className="text-sm font-medium">{label}</span>
      {hint ? (
        <span className="text-muted-foreground -mt-2 text-xs">{hint}</span>
      ) : null}
    </Link>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {action ? (
          <Link
            className="text-primary text-sm font-medium hover:underline"
            href={action.href}
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Bar({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const width = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="bg-muted h-2 overflow-hidden rounded-full">
        <span
          className="bg-primary block h-full rounded-full"
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

export function AdminOverview() {
  const stats = useQuery(api.admin.overview);
  const health = useQuery(api.admin.automationHealth);

  if (!(stats && health)) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton className="h-40 rounded-2xl" key={i} />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const totalLoans = LOAN_STATUSES.reduce((sum, s) => sum + stats.loans[s], 0);
  const { failed, remindersFailedThisWeek: reminderFailures } = health;
  const failedNotificationsHint = () => {
    if (failed > 0) return "Retry them from Automation";
    if (reminderFailures > 0) {
      return `${reminderFailures} overdue reminder${reminderFailures === 1 ? "" : "s"} failed this week; retried automatically`;
    }
    return "Every email delivered";
  };
  const tiles: { label: string; value: number; note?: string }[] = [
    {
      label: "Notifications delivered, last 7 days",
      value: health.deliveredThisWeek,
    },
    { label: "Notifications queued or retrying", value: health.queued },
    {
      label: "Notifications failed",
      note: failed > 0 ? "Retry from Automation" : undefined,
      value: failed,
    },
    {
      label: "Overdue reminders sent, last 7 days",
      note:
        reminderFailures > 0
          ? `${reminderFailures} failed, retried automatically`
          : undefined,
      value: health.remindersSentThisWeek,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          hint={`${stats.trustedLenders} trusted lender${stats.trustedLenders === 1 ? "" : "s"}`}
          href="/admin/neighbors"
          icon={Users}
          label="Neighbors"
          value={stats.neighbors.toLocaleString()}
        />
        <StatCard
          href="/admin/listings"
          icon={Wrench}
          label="Live listings"
          value={stats.listings.toLocaleString()}
        />
        <StatCard
          hint="Listings neighbors flagged"
          href="/admin/reports"
          icon={Flag}
          label="Open reports"
          tone={stats.openReports > 0 ? "warn" : "default"}
          value={stats.openReports.toLocaleString()}
        />
        <StatCard
          href="/admin/loans?status=requested"
          icon={Hourglass}
          label="Requests awaiting a decision"
          value={stats.loans.requested.toLocaleString()}
        />
        <StatCard
          hint="Approved loans past their end date"
          href="/admin/loans?status=overdue"
          icon={AlarmClock}
          label="Overdue"
          tone={stats.overdue > 0 ? "warn" : "default"}
          value={stats.overdue.toLocaleString()}
        />
        <StatCard
          hint={failedNotificationsHint()}
          href="/admin/automation"
          icon={failed > 0 ? CircleAlert : BadgeCheck}
          label="Failed notifications"
          tone={failed > 0 ? "bad" : "default"}
          value={failed.toLocaleString()}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          action={{ href: "/admin/loans", label: "All loans" }}
          title="Loans by status"
        >
          <div className="space-y-3">
            {LOAN_STATUSES.map((status) => (
              <Bar
                key={status}
                label={loanStatusLabel(status)}
                total={totalLoans}
                value={stats.loans[status]}
              />
            ))}
          </div>
        </Panel>
        <Panel
          action={{ href: "/admin/automation", label: "Open automation" }}
          title="Automation health"
        >
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {tiles.map(({ label, note, value }) => (
              <div className="bg-muted/60 rounded-xl p-3" key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-display mt-1 text-2xl font-semibold tabular-nums">
                  {value.toLocaleString()}
                </dd>
                {note ? (
                  <dd className="text-destructive mt-0.5 text-xs">{note}</dd>
                ) : null}
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <Panel
        action={{ href: "/admin/loans", label: "See all" }}
        title="Latest loans"
      >
        <LatestLoans />
      </Panel>
    </div>
  );
}
