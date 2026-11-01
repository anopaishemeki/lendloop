"use client";

import { X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/lib/tool-labels";
import {
  TOOL_CATEGORIES,
  TOOL_CONDITIONS,
  type ToolCategory,
  type ToolCondition,
} from "../../../convex/lib/validators";
import { UrlFilter } from "./url-filter";
import { UrlSearch } from "./url-search";
import {
  ALL,
  filterOptions,
  useEnumParam,
  useSearchText,
} from "./use-url-param";

const CATEGORY_OPTIONS = filterOptions(
  "Any category",
  TOOL_CATEGORIES,
  (value) => CATEGORY_LABELS[value]
);
const CONDITION_OPTIONS = filterOptions(
  "Any condition",
  TOOL_CONDITIONS,
  (value) => CONDITION_LABELS[value]
);

/** Back to the unfiltered page. */
export function ClearFilters({ basePath }: { basePath: string }) {
  return (
    <Button asChild size="sm" variant="ghost">
      <Link href={basePath} scroll={false}>
        <X aria-hidden />
        Clear filters
      </Link>
    </Button>
  );
}

/** The tool filters in the URL: ?q (name), ?category and ?condition. */
export function useToolFilters() {
  const search = useSearchText();
  const category = useEnumParam("category", TOOL_CATEGORIES);
  const condition = useEnumParam("condition", TOOL_CONDITIONS);
  return {
    filters: { category, condition, search },
    isFiltered: Boolean(search || category || condition),
  };
}

/**
 * Search by tool name plus category and condition, any combination, kept in
 * the URL. `extra` adds page-specific filters to the same row; "Clear filters"
 * appears once any filter is set and returns to the bare page.
 */
export function ToolFilterControls({
  basePath,
  extra,
  filtered,
  searchLabel,
}: {
  basePath: string;
  extra?: ReactNode;
  /** Whether any filter (including `extra`'s) is set. */
  filtered: boolean;
  searchLabel: string;
}) {
  const { category, condition } = useToolFilters().filters;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <UrlSearch
        basePath={basePath}
        label={searchLabel}
        placeholder="Search by tool name"
      />
      {extra}
      <UrlFilter<ToolCategory | typeof ALL>
        basePath={basePath}
        defaultValue={ALL}
        label="Filter by category"
        options={CATEGORY_OPTIONS}
        param="category"
        value={category ?? ALL}
      />
      <UrlFilter<ToolCondition | typeof ALL>
        basePath={basePath}
        defaultValue={ALL}
        label="Filter by condition"
        options={CONDITION_OPTIONS}
        param="condition"
        value={condition ?? ALL}
      />
      {filtered ? <ClearFilters basePath={basePath} /> : null}
    </div>
  );
}
