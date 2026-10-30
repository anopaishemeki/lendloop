import { Repeat } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      aria-label="LendLoop home"
      className={cn("group inline-flex items-center gap-2", className)}
      href={href}
    >
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform group-hover:rotate-12">
        <Repeat aria-hidden className="size-4" />
      </span>
      <span className="font-semibold font-serif text-xl tracking-tight">
        LendLoop
      </span>
    </Link>
  );
}
