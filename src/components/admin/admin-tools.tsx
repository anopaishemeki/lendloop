"use client";

import { usePaginatedQuery } from "convex/react";
import { CategoryIcon } from "@/components/category-icon";
import { AvailabilityBadge } from "@/components/tools/availability-badge";
import { RemoveToolButton } from "@/components/tools/remove-tool-button";
import { NameWithBadge } from "@/components/trusted-lender-badge";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/lib/tool-labels";
import { api } from "../../../convex/_generated/api";
import { ADMIN_PAGE_SIZE, TableState } from "./table-state";
import { ToolFilterControls, useToolFilters } from "./tool-filters";

const BASE_PATH = "/admin/listings";

/** Live listings, filtered by the URL's ?q (name), ?category and ?condition. */
export function AdminTools() {
  const { filters, isFiltered: filtered } = useToolFilters();
  const tools = usePaginatedQuery(api.admin.listTools, filters, {
    initialNumItems: ADMIN_PAGE_SIZE,
  });

  return (
    <div className="space-y-4">
      <ToolFilterControls
        basePath={BASE_PATH}
        filtered={filtered}
        searchLabel="Search listings by tool name"
      />
      <TableState
        empty={
          filtered ? "No listings match these filters." : "No listings yet."
        }
        query={tools}
      >
        {(rows) => (
          <>
            <TableHeader>
              <TableRow>
                <TableHead>Tool</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Lender</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="sr-only">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((tool) => (
                <TableRow key={tool._id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2.5">
                      <CategoryIcon category={tool.category} size="sm" />
                      {tool.name}
                    </span>
                  </TableCell>
                  <TableCell>{CATEGORY_LABELS[tool.category]}</TableCell>
                  <TableCell>{CONDITION_LABELS[tool.condition]}</TableCell>
                  <TableCell>
                    <NameWithBadge isTrustedLender={tool.owner.isTrustedLender}>
                      {tool.owner.name}
                    </NameWithBadge>
                  </TableCell>
                  <TableCell>
                    <AvailabilityBadge availability={tool.availability} />
                  </TableCell>
                  <TableCell className="text-right">
                    <RemoveToolButton
                      availability={tool.availability}
                      toolId={tool._id}
                      toolName={tool.name}
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
