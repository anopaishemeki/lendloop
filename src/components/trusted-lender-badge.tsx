import { BadgeCheck } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function TrustedLenderBadge({
  label = "Trusted lender",
}: {
  label?: string;
}) {
  return (
    <span className="text-primary inline-flex items-center gap-0.5 font-medium">
      <BadgeCheck aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}

/** Who someone is (a name, "Lent by Ben", a chip) followed by the badge when trusted. */
export function NameWithBadge({
  isTrustedLender,
  className,
  children,
}: {
  isTrustedLender: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5",
        className
      )}
    >
      {children}
      {isTrustedLender ? <TrustedLenderBadge /> : null}
    </span>
  );
}
