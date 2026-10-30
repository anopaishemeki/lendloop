import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ToolView } from "./types";

export function AvailabilityBadge({
  availability,
}: {
  availability: ToolView["availability"];
}) {
  const available = availability === "available";
  return (
    <Badge
      className={cn(
        "gap-1.5 px-2.5 py-1",
        available
          ? "bg-success/12 text-success"
          : "bg-warning/18 text-accent-foreground"
      )}
      variant="secondary"
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          available ? "bg-success" : "bg-warning"
        )}
      />
      {available ? "Available" : "On loan"}
    </Badge>
  );
}
