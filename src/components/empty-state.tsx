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
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card/60 px-6 py-14 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Icon aria-hidden className="size-6" />
      </span>
      <p className="font-medium font-serif text-lg">{title}</p>
      {children}
    </div>
  );
}
