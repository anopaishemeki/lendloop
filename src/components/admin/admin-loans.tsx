"use client";

import { usePaginatedQuery } from "convex/react";
import { useState } from "react";
import { LoanStatusBadge } from "@/components/loans/loan-status-badge";
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

export function AdminLoans() {
  const [status, setStatus] = useState<LoanStatus | typeof ALL>(ALL);
  const loans = usePaginatedQuery(
    api.admin.listLoans,
    { status: status === ALL ? undefined : status },
    { initialNumItems: ADMIN_PAGE_SIZE }
  );

  return (
    <div className="space-y-4">
      <Select
        onValueChange={(value) => setStatus(value as LoanStatus | typeof ALL)}
        value={status}
      >
        <SelectTrigger aria-label="Filter by status" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {LOAN_STATUSES.map((s) => (
            <SelectItem className="capitalize" key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <TableState empty="No loans match." query={loans}>
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
                  <TableCell>{loan.ownerName}</TableCell>
                  <TableCell>{loan.borrowerName}</TableCell>
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
    </div>
  );
}
