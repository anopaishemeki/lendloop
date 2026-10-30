import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { CategoryIcon } from "@/components/category-icon";
import { Neighbor } from "@/components/neighbor";
import { formatRange } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { LoanActions } from "./loan-actions";
import { LoanActivity } from "./loan-activity";
import { LoanStatusBadge } from "./loan-status-badge";
import type { LoanView } from "./types";

/** A calendar-style stub showing when the loan starts. */
function DateStub({ date }: { date: string }) {
  const day = parseISO(date);
  return (
    <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl border bg-background py-2 text-center">
      <span className="font-medium text-[0.65rem] text-terracotta uppercase tracking-widest">
        {format(day, "MMM")}
      </span>
      <span className="font-semibold font-serif text-2xl leading-none">
        {format(day, "d")}
      </span>
      <span className="text-[0.65rem] text-muted-foreground">
        {format(day, "EEE")}
      </span>
    </div>
  );
}

function duration(startDate: string, endDate: string) {
  const days =
    differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
  return days === 1 ? "1 day" : `${days} days`;
}

export function LoanCard({ loan }: { loan: LoanView }) {
  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-xs sm:flex-row sm:items-start sm:p-5",
        loan.isOverdue && "border-destructive/40"
      )}
    >
      <DateStub date={loan.startDate} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryIcon category={loan.tool.category} size="sm" />
          <h3 className="font-semibold text-lg leading-tight">
            {loan.tool.name}
          </h3>
          <LoanStatusBadge isOverdue={loan.isOverdue} status={loan.status} />
          {loan.tool.isRemoved ? (
            <span className="text-muted-foreground text-xs">
              Listing removed
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">
          {formatRange(loan.startDate, loan.endDate)}
          <span aria-hidden className="mx-1.5">
            ·
          </span>
          {duration(loan.startDate, loan.endDate)}
        </p>
        <Neighbor
          firstName={loan.counterpart.firstName}
          isTrustedLender={
            loan.role === "borrower" && loan.counterpart.isTrustedLender
          }
          prefix={loan.role === "owner" ? "Requested by" : "Lent by"}
        />
        {loan.note ? (
          <blockquote className="border-terracotta/50 border-l-2 pl-3 text-sm italic">
            {loan.note}
          </blockquote>
        ) : null}
        <LoanActivity
          loanId={loan._id}
          otherName={loan.counterpart.firstName}
        />
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
        <LoanActions loan={loan} />
      </div>
    </li>
  );
}
