"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { formatDistanceToNow } from "date-fns";
import { useSearchParams } from "next/navigation";
import { RemoveToolButton } from "@/components/tools/remove-tool-button";
import { NameWithBadge } from "@/components/trusted-lender-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  REPORT_REASON_LABELS,
  REPORT_STATUS_STYLES,
} from "@/lib/report-labels";
import { useToastAction } from "@/lib/use-toast-action";
import { api } from "../../../convex/_generated/api";
import {
  REPORT_REASONS,
  REPORT_STATUSES,
  type ReportReason,
  type ReportStatus,
} from "../../../convex/lib/validators";
import { ADMIN_PAGE_SIZE, TableState } from "./table-state";
import { ToolFilterControls, useToolFilters } from "./tool-filters";
import { UrlFilter } from "./url-filter";
import { filterOptions, useEnumParam } from "./use-url-param";

type ReportRow = FunctionReturnType<
  typeof api.admin.listReports
>["page"][number];

const ALL = "all";
type ReportFilter = ReportStatus | typeof ALL;

const FILTER_OPTIONS = [
  ...REPORT_STATUSES.map((value) => ({
    label: REPORT_STATUS_STYLES[value].label,
    value,
  })),
  { label: "All reports", value: ALL },
] as const;

/** Open reports unless the URL asks for another status (or all). */
function parseFilter(value: string | null): ReportFilter {
  if (value === ALL) return ALL;
  return REPORT_STATUSES.find((status) => status === value) ?? "open";
}

/** Dismiss, plus Remove while the listing is still up (tools.remove closes every open report). */
function ReportActions({ report }: { report: ReportRow }) {
  const dismiss = useMutation(api.admin.dismissReport);
  const { pending, run } = useToastAction();
  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        disabled={pending}
        onClick={() =>
          run(() => dismiss({ reportId: report._id }), "Report dismissed")
        }
        size="sm"
        variant="ghost"
      >
        Dismiss
      </Button>
      {report.availability ? (
        <RemoveToolButton
          availability={report.availability}
          toolId={report.toolId}
          toolName={report.toolName}
        />
      ) : null}
    </div>
  );
}

const BASE_PATH = "/admin/reports";
const REASON_OPTIONS = filterOptions(
  "Any reason",
  REPORT_REASONS,
  (value) => REPORT_REASON_LABELS[value]
);

/**
 * The report queue: open by default, filtered by the URL's ?status, ?reason,
 * ?q (the reported tool's name), ?category and ?condition.
 */
export function AdminReports() {
  const params = useSearchParams();
  const filter = parseFilter(params.get("status"));
  const reason = useEnumParam("reason", REPORT_REASONS);
  const { filters: toolFilters, isFiltered } = useToolFilters();
  const filtered = filter !== "open" || Boolean(reason) || isFiltered;
  const reports = usePaginatedQuery(
    api.admin.listReports,
    {
      ...toolFilters,
      reason,
      status: filter === ALL ? undefined : filter,
    },
    { initialNumItems: ADMIN_PAGE_SIZE }
  );

  return (
    <div className="space-y-4">
      <ToolFilterControls
        basePath={BASE_PATH}
        extra={
          <>
            <UrlFilter<ReportFilter>
              basePath={BASE_PATH}
              defaultValue="open"
              options={FILTER_OPTIONS}
              value={filter}
            />
            <UrlFilter<ReportReason | typeof ALL>
              basePath={BASE_PATH}
              defaultValue={ALL}
              label="Filter by reason"
              options={REASON_OPTIONS}
              param="reason"
              value={reason ?? ALL}
            />
          </>
        }
        filtered={filtered}
        searchLabel="Search reports by tool name"
      />
      <TableState
        empty={
          filtered ? "No reports match these filters." : "No open reports."
        }
        query={reports}
      >
        {(rows) => (
          <>
            <TableHeader>
              <TableRow>
                <TableHead>Listing</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Reported by</TableHead>
                <TableHead>Lender</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((report) => (
                <TableRow key={report._id}>
                  <TableCell className="font-medium">
                    {report.toolName}
                    {report.availability || report.status !== "open" ? null : (
                      <span className="text-muted-foreground block text-xs font-normal">
                        Removed by the lender
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-72 whitespace-normal">
                    {REPORT_REASON_LABELS[report.reason]}
                    {report.details ? (
                      <span className="text-muted-foreground block text-xs">
                        {report.details}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <NameWithBadge
                      isTrustedLender={report.reporter.isTrustedLender}
                    >
                      {report.reporter.name}
                    </NameWithBadge>
                  </TableCell>
                  <TableCell>
                    <NameWithBadge
                      isTrustedLender={report.owner.isTrustedLender}
                    >
                      {report.owner.name}
                    </NameWithBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(report._creationTime, {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    {report.status === "open" ? (
                      <ReportActions report={report} />
                    ) : (
                      <Badge
                        className={
                          REPORT_STATUS_STYLES[report.status].className
                        }
                        variant="secondary"
                      >
                        {REPORT_STATUS_STYLES[report.status].label}
                      </Badge>
                    )}
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
