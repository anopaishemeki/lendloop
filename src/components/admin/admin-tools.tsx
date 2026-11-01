"use client";

import { usePaginatedQuery } from "convex/react";
import { X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CategoryIcon } from "@/components/category-icon";
import { AvailabilityBadge } from "@/components/tools/availability-badge";
import { RemoveToolButton } from "@/components/tools/remove-tool-button";
import { NameWithBadge } from "@/components/trusted-lender-badge";
import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/lib/tool-labels";
import { api } from "../../../convex/_generated/api";
import {
  TOOL_CATEGORIES,
  TOOL_CONDITIONS,
  type ToolCategory,
  type ToolCondition,
} from "../../../convex/lib/validators";
import { ADMIN_PAGE_SIZE, TableState } from "./table-state";
import { UrlFilter } from "./url-filter";
import { UrlSearch } from "./url-search";

const ALL = "all";
const BASE_PATH = "/admin/listings";

const CATEGORY_OPTIONS = [
  { label: "Any category", value: ALL },
  ...TOOL_CATEGORIES.map((value) => ({ label: CATEGORY_LABELS[value], value })),
] as const;
const CONDITION_OPTIONS = [
  { label: "Any condition", value: ALL },
  ...TOOL_CONDITIONS.map((value) => ({
    label: CONDITION_LABELS[value],
    value,
  })),
] as const;

/** Live listings, filtered by the URL's ?q (name), ?category and ?condition. */
export function AdminTools() {
  const params = useSearchParams();
  const search = params.get("q")?.trim() || undefined;
  const category = TOOL_CATEGORIES.find((v) => v === params.get("category"));
  const condition = TOOL_CONDITIONS.find((v) => v === params.get("condition"));
  const filtered = Boolean(search || category || condition);
  const tools = usePaginatedQuery(
    api.admin.listTools,
    { category, condition, search },
    { initialNumItems: ADMIN_PAGE_SIZE }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <UrlSearch
          basePath={BASE_PATH}
          label="Search listings by name"
          placeholder="Search by name"
        />
        <UrlFilter<ToolCategory | typeof ALL>
          basePath={BASE_PATH}
          defaultValue={ALL}
          label="Filter by category"
          options={CATEGORY_OPTIONS}
          param="category"
          value={category ?? ALL}
        />
        <UrlFilter<ToolCondition | typeof ALL>
          basePath={BASE_PATH}
          defaultValue={ALL}
          label="Filter by condition"
          options={CONDITION_OPTIONS}
          param="condition"
          value={condition ?? ALL}
        />
        {filtered ? (
          <Button asChild size="sm" variant="ghost">
            <Link href={BASE_PATH} scroll={false}>
              <X aria-hidden />
              Clear filters
            </Link>
          </Button>
        ) : null}
      </div>
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
