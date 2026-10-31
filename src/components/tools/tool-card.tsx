import type { ReactNode } from "react";
import { CategoryIcon } from "@/components/category-icon";
import { Neighbor } from "@/components/neighbor";
import { NameWithBadge } from "@/components/trusted-lender-badge";
import { Badge } from "@/components/ui/badge";
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
    <article className="group surface flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <CategoryIcon category={tool.category} />
        <AvailabilityBadge availability={tool.availability} />
      </div>
      <h3 className="font-display mt-4 text-xl leading-snug font-semibold">
        {tool.name}
      </h3>
      <p className="text-muted-foreground mt-1 text-sm">
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
          <NameWithBadge isTrustedLender={tool.owner.isTrustedLender}>
            <Badge variant="outline">Your listing</Badge>
          </NameWithBadge>
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
