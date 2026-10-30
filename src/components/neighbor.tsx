import { TrustedLenderBadge } from "@/components/trusted-lender-badge";

/** A neighbor shown by first name with a monogram, plus the trusted badge. */
export function Neighbor({
  prefix,
  firstName,
  isTrustedLender,
}: {
  prefix: string;
  firstName: string;
  isTrustedLender: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
      <span
        aria-hidden
        className="inline-flex size-6 items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground text-xs"
      >
        {firstName.charAt(0).toUpperCase()}
      </span>
      <span>
        {prefix} <span className="text-foreground">{firstName}</span>
      </span>
      {isTrustedLender ? <TrustedLenderBadge /> : null}
    </span>
  );
}
