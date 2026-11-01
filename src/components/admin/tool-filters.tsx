"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

const ANY = "all";

const CATEGORY_OPTIONS = [
  { label: "Any category", value: ANY },
  ...TOOL_CATEGORIES.map((value) => ({ label: CATEGORY_LABELS[value], value })),
] as const;
const CONDITION_OPTIONS = [
  { label: "Any condition", value: ANY },
  ...TOOL_CONDITIONS.map((value) => ({
    label: CONDITION_LABELS[value],
    value,
  })),
] as const;

/** The tool filters in the URL: ?q (name), ?category and ?condition. */
export function useToolFilters() {
  const params = useSearchParams();
  const search = params.get("q")?.trim() || undefined;
  const category = TOOL_CATEGORIES.find((v) => v === params.get("category"));
  const condition = TOOL_CONDITIONS.find((v) => v === params.get("condition"));
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
      <UrlFilter<ToolCategory | typeof ANY>
        basePath={basePath}
        defaultValue={ANY}
        label="Filter by category"
        options={CATEGORY_OPTIONS}
        param="category"
        value={category ?? ANY}
      />
      <UrlFilter<ToolCondition | typeof ANY>
        basePath={basePath}
        defaultValue={ANY}
        label="Filter by condition"
        options={CONDITION_OPTIONS}
        param="condition"
        value={condition ?? ANY}
      />
      {filtered ? (
        <Button asChild size="sm" variant="ghost">
          <Link href={basePath} scroll={false}>
            <X aria-hidden />
            Clear filters
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
