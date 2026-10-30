import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { fail } from "../auth";
import type { LoanStatus } from "./validators";

const TRANSITIONS: Record<LoanStatus, readonly LoanStatus[]> = {
  approved: ["returned", "cancelled"],
  cancelled: [],
  declined: [],
  requested: ["approved", "declined", "cancelled"],
  returned: [],
};

export function canTransition(from: LoanStatus, to: LoanStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** The single place a loan changes status, so every change is validated the same way. */
export async function transitionLoan(
  ctx: MutationCtx,
  loan: Doc<"loans">,
  to: LoanStatus,
  now = Date.now()
): Promise<void> {
  if (!canTransition(loan.status, to)) {
    fail("INVALID_TRANSITION", `A ${loan.status} loan cannot become ${to}.`);
  }
  await ctx.db.patch(loan._id, {
    status: to,
    ...(to === "returned" ? { returnedAt: now } : { decidedAt: now }),
  });
}
