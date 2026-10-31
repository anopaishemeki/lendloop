import { Pencil } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Id } from "../../../convex/_generated/dataModel";
import { RemoveToolButton } from "./remove-tool-button";
import type { ToolView } from "./types";

/** Edit link for a listing the viewer owns; safe to show while browsing. */
export function EditToolLink({ toolId }: { toolId: Id<"tools"> }) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={`/tools/${toolId}/edit`}>
        <Pencil aria-hidden />
        Edit
      </Link>
    </Button>
  );
}

/** Edit and Remove for the owner's own shelf (My listings). */
export function OwnToolActions({ tool }: { tool: ToolView }) {
  return (
    <>
      <EditToolLink toolId={tool._id} />
      <RemoveToolButton
        availability={tool.availability}
        toolId={tool._id}
        toolName={tool.name}
      />
    </>
  );
}
