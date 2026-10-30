"use client";

import { useQuery } from "convex/react";
import { PackageOpen } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS } from "@/lib/tool-labels";
import { api } from "../../convex/_generated/api";

const GRID = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";

/** Read-only list for signed-out visitors: name and category only. */
export function PublicToolList() {
  const tools = useQuery(api.tools.listPublic);

  if (tools === undefined) {
    return (
      <div className={GRID}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton className="h-[4.5rem] rounded-xl" key={i} />
        ))}
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <EmptyState icon={PackageOpen} title="The shelf is empty for now">
        <p className="text-muted-foreground text-sm">
          Sign in and be the first to lend something.
        </p>
      </EmptyState>
    );
  }

  return (
    <ul className={GRID}>
      {tools.map((tool, i) => (
        <li
          className="surface flex items-center gap-3 rounded-xl px-4 py-3"
          // The public query deliberately omits ids, so position is the key.
          key={`${i}-${tool.name}`}
        >
          <CategoryIcon category={tool.category} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium">{tool.name}</p>
            <p className="text-muted-foreground text-xs">
              {CATEGORY_LABELS[tool.category]}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
