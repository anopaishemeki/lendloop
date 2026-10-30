import { BadgeCheck } from "lucide-react";

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
