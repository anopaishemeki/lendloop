"use client";

import { useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS } from "@/lib/tool-labels";
import { api } from "../../convex/_generated/api";

export function PublicToolList() {
  const tools = useQuery(api.tools.listPublic);

  if (tools === undefined) {
    return (
      <div className="grid gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton className="h-12" key={i} />
        ))}
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
        Nothing listed yet. Sign in and be the first to lend something.
      </p>
    );
  }

  return (
    <ul className="bg-card divide-y rounded-lg border">
      {tools.map((tool, i) => (
        <li
          className="flex items-center justify-between gap-3 px-4 py-3"
          // The public query deliberately omits ids, so position is the key.
          key={`${i}-${tool.name}`}
        >
          <span className="font-medium">{tool.name}</span>
          <Badge variant="outline">{CATEGORY_LABELS[tool.category]}</Badge>
        </li>
      ))}
    </ul>
  );
}
