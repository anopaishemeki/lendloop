import type { ReactNode } from "react";
import { CategoryIcon } from "@/components/category-icon";
import { Neighbor } from "@/components/neighbor";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/lib/tool-labels";
import { AvailabilityBadge } from "./availability-badge";
import type { ToolView } from "./types";

export function ToolCard({
  tool,
  actions,
}: {
  // The id isn't shown, so the form preview can render an unsaved tool.
  tool: Omit<ToolView, "_id">;
  actions?: ReactNode;
}) {
  return (
    <article className="group flex flex-col rounded-2xl border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <CategoryIcon category={tool.category} />
        <AvailabilityBadge availability={tool.availability} />
      </div>
      <h3 className="mt-4 font-semibold text-xl leading-snug">{tool.name}</h3>
      <p className="mt-1 text-muted-foreground text-sm">
        {CATEGORY_LABELS[tool.category]}
        <span aria-hidden className="mx-1.5">
          ·
        </span>
        {CONDITION_LABELS[tool.condition]}
      </p>
      {tool.description ? (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed">
          {tool.description}
        </p>
      ) : null}
      <div className="mt-auto pt-4">
        {tool.isMine ? (
          <span className="inline-flex rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground text-xs">
            Your listing
          </span>
        ) : (
          <Neighbor
            firstName={tool.owner.firstName}
            isTrustedLender={tool.owner.isTrustedLender}
            prefix="Lent by"
          />
        )}
      </div>
      {actions ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">{actions}</div>
      ) : null}
    </article>
  );
}
