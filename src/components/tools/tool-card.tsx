import { BadgeCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/lib/tool-labels";
import { AvailabilityBadge } from "./availability-badge";
import type { ToolView } from "./types";

export function ToolCard({
  tool,
  actions,
}: {
  tool: ToolView;
  actions?: ReactNode;
}) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{tool.name}</CardTitle>
          <AvailabilityBadge availability={tool.availability} />
        </div>
        <CardDescription className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{CATEGORY_LABELS[tool.category]}</Badge>
          <span>{CONDITION_LABELS[tool.condition]}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 text-sm">
        {tool.description ? (
          <p className="text-muted-foreground line-clamp-3">
            {tool.description}
          </p>
        ) : null}
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          {tool.isMine ? "Your listing" : `Lent by ${tool.owner.firstName}`}
          {tool.owner.isTrustedLender ? (
            <span className="text-primary inline-flex items-center gap-0.5 font-medium">
              <BadgeCheck aria-hidden className="size-3.5" />
              Trusted lender
            </span>
          ) : null}
        </p>
      </CardContent>
      {actions ? <CardFooter className="gap-2">{actions}</CardFooter> : null}
    </Card>
  );
}
