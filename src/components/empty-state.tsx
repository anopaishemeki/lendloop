import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  icon: Icon = Inbox,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <div className="bg-card/60 flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-14 text-center">
      <span className="bg-secondary text-secondary-foreground inline-flex size-12 items-center justify-center rounded-full">
        <Icon aria-hidden className="size-6" />
      </span>
      <p className="font-display text-lg font-medium">{title}</p>
      {children}
    </div>
  );
}
