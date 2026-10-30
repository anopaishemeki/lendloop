"use client";

import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS } from "@/lib/tool-labels";
import {
  TOOL_CATEGORIES,
  type ToolCategory,
} from "../../../convex/lib/validators";

export function CategoryFilter({
  value,
  onChange,
}: {
  value: ToolCategory | undefined;
  onChange: (category: ToolCategory | undefined) => void;
}) {
  return (
    <fieldset className="mb-6 flex flex-wrap gap-2">
      <legend className="sr-only">Filter by category</legend>
      <Button
        aria-pressed={value === undefined}
        onClick={() => onChange(undefined)}
        size="sm"
        variant={value === undefined ? "default" : "outline"}
      >
        All
      </Button>
      {TOOL_CATEGORIES.map((category) => (
        <Button
          aria-pressed={value === category}
          key={category}
          onClick={() => onChange(category)}
          size="sm"
          variant={value === category ? "default" : "outline"}
        >
          {CATEGORY_LABELS[category]}
        </Button>
      ))}
    </fieldset>
  );
}
