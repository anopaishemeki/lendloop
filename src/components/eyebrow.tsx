import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small uppercase label above a heading. */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-terracotta text-xs font-medium tracking-[0.18em] uppercase",
        className
      )}
    >
      {children}
    </p>
  );
}
