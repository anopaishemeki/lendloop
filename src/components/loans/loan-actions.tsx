"use client";

import { useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import {
  Check,
  type LucideIcon,
  PackageCheck,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToastAction } from "@/lib/use-toast-action";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LoanView } from "./types";

type LoanMutation = FunctionReference<
  "mutation",
  "public",
  { loanId: Id<"loans"> },
  null
>;

function ActionButton({
  loanId,
  mutation,
  icon: Icon,
  label,
  success,
  variant = "outline",
}: {
  loanId: Id<"loans">;
  mutation: LoanMutation;
  icon: LucideIcon;
  label: string;
  success: string;
  variant?: "default" | "outline" | "ghost";
}) {
  const runMutation = useMutation(mutation);
  const { pending, run } = useToastAction();

  return (
    <Button
      disabled={pending}
      onClick={() => run(() => runMutation({ loanId }), success)}
      size="sm"
      variant={variant}
    >
      <Icon aria-hidden />
      {label}
    </Button>
  );
}

export function LoanActions({ loan }: { loan: LoanView }) {
  const { _id: loanId } = loan;
  return (
    <>
      {loan.canApprove ? (
        <ActionButton
          icon={Check}
          label="Approve"
          loanId={loanId}
          mutation={api.loans.approve}
          success="Request approved"
          variant="default"
        />
      ) : null}
      {loan.canDecline ? (
        <ActionButton
          icon={X}
          label="Decline"
          loanId={loanId}
          mutation={api.loans.decline}
          success="Request declined"
        />
      ) : null}
      {loan.canMarkReturned ? (
        <ActionButton
          icon={PackageCheck}
          label="Mark returned"
          loanId={loanId}
          mutation={api.loans.markReturned}
          success="Marked as returned"
          variant="default"
        />
      ) : null}
      {loan.canCancel ? (
        <ActionButton
          icon={Undo2}
          label={loan.status === "requested" ? "Withdraw" : "Cancel loan"}
          loanId={loanId}
          mutation={api.loans.cancel}
          success="Cancelled"
          variant="ghost"
        />
      ) : null}
    </>
  );
}
