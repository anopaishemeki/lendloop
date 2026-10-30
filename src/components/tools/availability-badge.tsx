import { cn } from "@/lib/utils";
import type { ToolView } from "./types";

export function AvailabilityBadge({
  availability,
}: {
  availability: ToolView["availability"];
}) {
  const available = availability === "available";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        available
          ? "bg-success/12 text-success"
          : "bg-warning/18 text-accent-foreground"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          available ? "bg-success" : "bg-warning"
        )}
      />
      {available ? "Available" : "On loan"}
    </span>
  );
}
