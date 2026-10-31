"use client";

import { useMutation } from "convex/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToastAction } from "@/lib/use-toast-action";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Availability } from "../../../convex/lib/availability";

export function RemoveToolButton({
  toolId,
  toolName,
  availability,
}: {
  toolId: Id<"tools">;
  toolName: string;
  availability: Availability;
}) {
  const isOnLoan = availability === "on_loan";
  const remove = useMutation(api.tools.remove);
  const { run } = useToastAction();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost">
          Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {toolName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Open requests are declined and upcoming loans cancelled. Past loans
            stay in history.
            {isOnLoan
              ? " This tool is lent out right now: that loan stays open until the owner marks it returned."
              : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep listing</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90 text-white"
            onClick={() => run(() => remove({ toolId }), `${toolName} removed`)}
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
