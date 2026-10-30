import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { fail } from "../auth";
import type { LoanStatus } from "./validators";

const TRANSITIONS: Record<LoanStatus, readonly LoanStatus[]> = {
  approved: ["returned", "cancelled"],
  cancelled: [],
  declined: [],
  requested: ["approved", "declined", "cancelled"],
  returned: [],
};

export function loansForTool(
  ctx: QueryCtx,
  toolId: Id<"tools">,
  status: "requested" | "approved"
) {
  return ctx.db
    .query("loans")
    .withIndex("by_tool_and_status_and_start_date", (q) =>
      q.eq("toolId", toolId).eq("status", status)
    )
    .collect();
}

export function isOverdue(
  loan: Pick<Doc<"loans">, "status" | "endDate">,
  today: string
): boolean {
  return loan.status === "approved" && loan.endDate < today;
}

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
