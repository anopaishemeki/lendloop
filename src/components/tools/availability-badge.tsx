import { Badge } from "@/components/ui/badge";
import type { ToolView } from "./types";

export function AvailabilityBadge({
  availability,
}: {
  availability: ToolView["availability"];
}) {
  return availability === "available" ? (
    <Badge className="bg-success/15 text-success" variant="secondary">
      Available
    </Badge>
  ) : (
    <Badge className="bg-warning/20 text-accent-foreground" variant="secondary">
      On loan
    </Badge>
  );
}
