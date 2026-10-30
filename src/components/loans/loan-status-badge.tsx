import { cn } from "@/lib/utils";
import type { LoanStatus } from "../../../convex/lib/validators";

const STYLES: Record<LoanStatus, { label: string; className: string }> = {
  approved: {
    className: "bg-secondary text-secondary-foreground",
    label: "Approved",
  },
  cancelled: {
    className: "bg-muted text-muted-foreground",
    label: "Cancelled",
  },
  declined: { className: "bg-muted text-muted-foreground", label: "Declined" },
  requested: {
    className: "bg-warning/18 text-accent-foreground",
    label: "Pending",
  },
  returned: { className: "bg-success/12 text-success", label: "Returned" },
};

export function LoanStatusBadge({
  status,
  isOverdue,
}: {
  status: LoanStatus;
  isOverdue: boolean;
}) {
  const { className, label } = isOverdue
    ? { className: "bg-destructive/12 text-destructive", label: "Overdue" }
    : STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className
      )}
    >
      {label}
    </span>
  );
}
