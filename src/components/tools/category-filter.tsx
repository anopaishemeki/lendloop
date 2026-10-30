"use client";

import { LayoutGrid } from "lucide-react";
import type { ReactNode } from "react";
import { CATEGORY_LABELS, CATEGORY_STYLES } from "@/lib/tool-labels";
import { cn } from "@/lib/utils";
import {
  TOOL_CATEGORIES,
  type ToolCategory,
} from "../../../convex/lib/validators";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-medium text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground"
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function CategoryFilter({
  value,
  onChange,
}: {
  value: ToolCategory | undefined;
  onChange: (category: ToolCategory | undefined) => void;
}) {
  return (
    <fieldset className="mb-8 flex flex-wrap gap-2">
      <legend className="sr-only">Filter by category</legend>
      <Chip active={value === undefined} onClick={() => onChange(undefined)}>
        <LayoutGrid aria-hidden className="size-4" />
        All
      </Chip>
      {TOOL_CATEGORIES.map((category) => {
        const Icon = CATEGORY_STYLES[category].icon;
        return (
          <Chip
            active={value === category}
            key={category}
            onClick={() => onChange(category)}
          >
            <Icon aria-hidden className="size-4" />
            {CATEGORY_LABELS[category]}
          </Chip>
        );
      })}
    </fieldset>
  );
}
