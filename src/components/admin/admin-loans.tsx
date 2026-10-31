"use client";

import { usePaginatedQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LoanStatusBadge,
  loanStatusLabel,
} from "@/components/loans/loan-status-badge";
import { NameWithBadge } from "@/components/trusted-lender-badge";
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
import { formatRange } from "@/lib/dates";
import { api } from "../../../convex/_generated/api";
import { LOAN_STATUSES, type LoanStatus } from "../../../convex/lib/validators";
import { ADMIN_PAGE_SIZE, TableState } from "./table-state";

const ALL = "all";
const OVERDUE = "overdue";
const PREVIEW_ROWS = 5;

type LoanFilter = LoanStatus | typeof OVERDUE;

function parseFilter(value: string | null): LoanFilter | undefined {
  if (value === OVERDUE) return OVERDUE;
  return LOAN_STATUSES.find((status) => status === value);
}

/** The status filter lives in the URL, so overview links and reloads agree. */
function StatusFilter({ value }: { value: LoanFilter | undefined }) {
  const router = useRouter();
  return (
    <Select
      onValueChange={(next) =>
        router.replace(
          next === ALL ? "/admin/loans" : `/admin/loans?status=${next}`,
          { scroll: false }
        )
      }
      value={value ?? ALL}
    >
      <SelectTrigger aria-label="Filter by status" className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All statuses</SelectItem>
        {LOAN_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {loanStatusLabel(s)}
          </SelectItem>
        ))}
        <SelectItem value={OVERDUE}>Overdue</SelectItem>
      </SelectContent>
    </Select>
  );
}

/** Every loan, filtered by the URL's ?status (including "overdue"). */
export function AdminLoans() {
  const status = parseFilter(useSearchParams().get("status"));
  return (
    <div className="space-y-4">
      <StatusFilter value={status} />
      <LoanTable status={status} />
    </div>
  );
}

/** The latest few loans, for the overview. */
export function LatestLoans() {
  return <LoanTable preview />;
}

/** `preview` shows the first few rows and leaves paging to the full page. */
function LoanTable({
  status,
  preview = false,
}: {
  status?: LoanFilter;
  preview?: boolean;
}) {
  const loans = usePaginatedQuery(
    api.admin.listLoans,
    { status },
    { initialNumItems: preview ? PREVIEW_ROWS : ADMIN_PAGE_SIZE }
  );

  return (
    <TableState empty="No loans match." query={loans} showLoadMore={!preview}>
      {(rows) => (
        <>
          <TableHeader>
            <TableRow>
              <TableHead>Tool</TableHead>
              <TableHead>Lender</TableHead>
              <TableHead>Borrower</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((loan) => (
              <TableRow key={loan._id}>
                <TableCell className="font-medium">{loan.toolName}</TableCell>
                <TableCell>
                  <NameWithBadge isTrustedLender={loan.owner.isTrustedLender}>
                    {loan.owner.name}
                  </NameWithBadge>
                </TableCell>
                <TableCell>
                  <NameWithBadge
                    isTrustedLender={loan.borrower.isTrustedLender}
                  >
                    {loan.borrower.name}
                  </NameWithBadge>
                </TableCell>
                <TableCell>
                  {formatRange(loan.startDate, loan.endDate)}
                </TableCell>
                <TableCell>
                  <LoanStatusBadge
                    isOverdue={loan.isOverdue}
                    status={loan.status}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </>
      )}
    </TableState>
  );
}
