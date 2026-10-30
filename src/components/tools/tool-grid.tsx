import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ToolCard } from "./tool-card";
import type { ToolView } from "./types";

const GRID = "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";

/** Loading, empty and populated states for a list of tool cards. */
export function ToolGrid({
  label,
  tools,
  emptyTitle,
  emptyHint,
  emptyIcon,
  emptyAction,
  actions,
}: {
  /** Section heading for screen readers; the page title is the visible h1. */
  label: string;
  tools: ToolView[] | undefined;
  emptyTitle: string;
  emptyHint: string;
  emptyIcon?: LucideIcon;
  emptyAction?: ReactNode;
  actions?: (tool: ToolView) => ReactNode;
}) {
  if (tools === undefined) {
    return (
      <div className={GRID}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton className="h-56 rounded-2xl" key={i} />
        ))}
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <EmptyState icon={emptyIcon} title={emptyTitle}>
        <p className="text-muted-foreground max-w-sm text-sm">{emptyHint}</p>
        {emptyAction}
      </EmptyState>
    );
  }

  return (
    <section>
      <h2 className="sr-only">{label}</h2>
      <div className={GRID}>
        {tools.map((tool) => (
          <ToolCard actions={actions?.(tool)} key={tool._id} tool={tool} />
        ))}
      </div>
    </section>
  );
}
