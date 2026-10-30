"use client";

import { useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
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
  label,
  success,
  variant = "outline",
}: {
  loanId: Id<"loans">;
  mutation: LoanMutation;
  label: string;
  success: string;
  variant?: "default" | "outline" | "ghost";
}) {
  const run = useMutation(mutation);
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    try {
      await run({ loanId });
      toast.success(success);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      disabled={pending}
      onClick={handleClick}
      size="sm"
      variant={variant}
    >
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
          label="Approve"
          loanId={loanId}
          mutation={api.loans.approve}
          success="Request approved"
          variant="default"
        />
      ) : null}
      {loan.canDecline ? (
        <ActionButton
          label="Decline"
          loanId={loanId}
          mutation={api.loans.decline}
          success="Request declined"
        />
      ) : null}
      {loan.canMarkReturned ? (
        <ActionButton
          label="Mark returned"
          loanId={loanId}
          mutation={api.loans.markReturned}
          success="Marked as returned"
          variant="default"
        />
      ) : null}
      {loan.canCancel ? (
        <ActionButton
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
