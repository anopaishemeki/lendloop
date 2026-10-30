import { Repeat } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  href = "/",
  inverted = false,
  className,
}: {
  href?: string;
  /** For use on a primary-colored background. */
  inverted?: boolean;
  className?: string;
}) {
  return (
    <Link
      aria-label="LendLoop home"
      className={cn("group inline-flex items-center gap-2", className)}
      href={href}
    >
      <span
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-lg shadow-sm transition-transform group-hover:rotate-12",
          inverted
            ? "bg-primary-foreground text-primary"
            : "bg-primary text-primary-foreground"
        )}
      >
        <Repeat aria-hidden className="size-4" />
      </span>
      <span className="font-display text-xl font-semibold">LendLoop</span>
    </Link>
  );
}
