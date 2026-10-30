import type { ReactNode } from "react";

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
        {eyebrow ? (
          <p className="font-medium text-terracotta text-xs uppercase tracking-[0.18em]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-semibold text-3xl sm:text-4xl">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
