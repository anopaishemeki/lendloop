import { TrustedLenderBadge } from "@/components/trusted-lender-badge";
import { formatRange } from "@/lib/dates";
import { LoanActions } from "./loan-actions";
import { LoanActivity } from "./loan-activity";
import { LoanStatusBadge } from "./loan-status-badge";
import type { LoanView } from "./types";

export function LoanCard({ loan }: { loan: LoanView }) {
  const who =
    loan.role === "owner"
      ? `Requested by ${loan.counterpart.firstName}`
      : `Lent by ${loan.counterpart.firstName}`;

  return (
    <li className="bg-card flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{loan.tool.name}</p>
          <LoanStatusBadge isOverdue={loan.isOverdue} status={loan.status} />
          {loan.tool.isRemoved ? (
            <span className="text-muted-foreground text-xs">
              Listing removed
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">
          {formatRange(loan.startDate, loan.endDate)}
        </p>
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          {who}
          {loan.role === "borrower" && loan.counterpart.isTrustedLender ? (
            <TrustedLenderBadge />
          ) : null}
        </p>
        {loan.note ? (
          <p className="text-sm italic">&ldquo;{loan.note}&rdquo;</p>
        ) : null}
        <LoanActivity
          loanId={loan._id}
          otherName={loan.counterpart.firstName}
        />
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <LoanActions loan={loan} />
      </div>
    </li>
  );
}
