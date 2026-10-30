import { Badge } from "@/components/ui/badge";
import type { LoanStatus } from "../../../convex/lib/validators";

const STYLES: Record<LoanStatus, { label: string; className: string }> = {
  approved: { className: "bg-primary/15 text-primary", label: "Approved" },
  cancelled: { className: "text-muted-foreground", label: "Cancelled" },
  declined: { className: "text-muted-foreground", label: "Declined" },
  requested: {
    className: "bg-warning/20 text-accent-foreground",
    label: "Pending",
  },
  returned: { className: "bg-success/15 text-success", label: "Returned" },
};

export function LoanStatusBadge({
  status,
  isOverdue,
}: {
  status: LoanStatus;
  isOverdue: boolean;
}) {
  if (isOverdue) {
    return (
      <Badge className="bg-destructive/15 text-destructive" variant="secondary">
        Overdue
      </Badge>
    );
  }
  const { className, label } = STYLES[status];
  return (
    <Badge className={className} variant="secondary">
      {label}
    </Badge>
  );
}
