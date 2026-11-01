"use client";

import { usePaginatedQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { useSearchParams } from "next/navigation";
import {
  LoanStatusBadge,
  loanStatusLabel,
} from "@/components/loans/loan-status-badge";
import { NameWithBadge } from "@/components/trusted-lender-badge";
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
import { ToolFilterControls, useToolFilters } from "./tool-filters";
import { UrlFilter } from "./url-filter";

const ALL = "all";
const OVERDUE = "overdue";
const PREVIEW_ROWS = 5;

type LoanFilter = LoanStatus | typeof OVERDUE;

function parseFilter(value: string | null): LoanFilter | undefined {
  if (value === OVERDUE) return OVERDUE;
  return LOAN_STATUSES.find((status) => status === value);
}

const FILTER_OPTIONS = [
  { label: "All statuses", value: ALL },
  ...LOAN_STATUSES.map((value) => ({ label: loanStatusLabel(value), value })),
  { label: "Overdue", value: OVERDUE },
] as const;

const BASE_PATH = "/admin/loans";

/**
 * Every loan, filtered by the URL's ?status (including "overdue"), ?q (the
 * borrowed tool's name), ?category and ?condition.
 */
export function AdminLoans() {
  const status = parseFilter(useSearchParams().get("status"));
  const { filters: toolFilters, isFiltered } = useToolFilters();
  const filtered = Boolean(status) || isFiltered;
  return (
    <div className="space-y-4">
      <ToolFilterControls
        basePath={BASE_PATH}
        extra={
          <UrlFilter<LoanFilter | typeof ALL>
            basePath={BASE_PATH}
            defaultValue={ALL}
            options={FILTER_OPTIONS}
            value={status ?? ALL}
          />
        }
        filtered={filtered}
        searchLabel="Search loans by tool name"
      />
      <LoanTable filters={{ ...toolFilters, status }} />
    </div>
  );
}

/** The latest few loans, for the overview. */
export function LatestLoans() {
  return <LoanTable preview />;
}

/** `preview` shows the first few rows and leaves paging to the full page. */
function LoanTable({
  filters = {},
  preview = false,
}: {
  filters?: Omit<FunctionArgs<typeof api.admin.listLoans>, "paginationOpts">;
  preview?: boolean;
}) {
  const loans = usePaginatedQuery(api.admin.listLoans, filters, {
    initialNumItems: preview ? PREVIEW_ROWS : ADMIN_PAGE_SIZE,
  });

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
