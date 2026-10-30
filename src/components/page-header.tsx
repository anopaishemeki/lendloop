import type { ReactNode } from "react";
import { Eyebrow } from "./eyebrow";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-6">
      <div className="space-y-1.5">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground max-w-2xl">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
