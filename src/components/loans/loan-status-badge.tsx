import { Badge } from "@/components/ui/badge";
import { STATUS_TONES } from "@/lib/status-tones";
import type { LoanStatus } from "../../../convex/lib/validators";

const STYLES: Record<LoanStatus, { label: string; className: string }> = {
  approved: { className: STATUS_TONES.info, label: "Approved" },
  cancelled: { className: STATUS_TONES.muted, label: "Cancelled" },
  declined: { className: STATUS_TONES.muted, label: "Declined" },
  requested: { className: STATUS_TONES.warn, label: "Pending" },
  returned: { className: STATUS_TONES.good, label: "Returned" },
};

export function loanStatusLabel(status: LoanStatus) {
  return STYLES[status].label;
}

export function LoanStatusBadge({
  status,
  isOverdue,
}: {
  status: LoanStatus;
  isOverdue: boolean;
}) {
  const { className, label } = isOverdue
    ? { className: STATUS_TONES.bad, label: "Overdue" }
    : STYLES[status];
  return (
    <Badge className={className} variant="secondary">
      {label}
    </Badge>
  );
}
