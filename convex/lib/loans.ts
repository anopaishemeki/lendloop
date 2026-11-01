import type { Trigger } from "convex-helpers/server/triggers";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { fail } from "../auth";
import { isOnLoan } from "./availability";
import type { DateRange } from "./dates";
import { enqueueNotification } from "./notifications";
import {
  CLOSED_LOAN_STATUSES,
  type LoanStatus,
  type NotificationEvent,
} from "./validators";

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

/** The tool fields a loan keeps a copy of, for admin search and filters. */
export function toolFieldsOf(
  tool: Pick<Doc<"tools">, "name" | "category" | "condition">
) {
  return {
    toolCategory: tool.category,
    toolCondition: tool.condition,
    toolName: tool.name,
  };
}

/**
 * Trigger on tools: when a tool's name, category or condition changes (by any
 * write path), refresh the copy its loans keep. Registered in convex/functions.ts.
 */
export const syncLoanToolFields: Trigger<
  MutationCtx,
  DataModel,
  "tools"
> = async (ctx, { newDoc, oldDoc }) => {
  if (!(oldDoc && newDoc)) return;
  const fields = toolFieldsOf(newDoc);
  const before = toolFieldsOf(oldDoc);
  if (
    fields.toolName === before.toolName &&
    fields.toolCategory === before.toolCategory &&
    fields.toolCondition === before.toolCondition
  ) {
    return;
  }
  const loans = await ctx.db
    .query("loans")
    .withIndex("by_tool_and_status_and_start_date", (q) =>
      q.eq("toolId", newDoc._id)
    )
    .collect();
  await Promise.all(loans.map((loan) => ctx.db.patch(loan._id, fields)));
};

/** Approved loans past their end date, oldest end date first. */
export function overdueLoans(ctx: QueryCtx, today: string) {
  return ctx.db
    .query("loans")
    .withIndex("by_status_and_end_date", (q) =>
      q.eq("status", "approved").lt("endDate", today)
    );
}

export function isOverdue(
  loan: Pick<Doc<"loans">, "status" | "endDate">,
  today: string
): boolean {
  return loan.status === "approved" && loan.endDate < today;
}

/**
 * The days an approved loan actually blocks. An overdue loan keeps the tool
 * until it is returned, so its range runs at least through today.
 */
export function blockedRange(
  loan: Pick<Doc<"loans">, "status" | "startDate" | "endDate">,
  today: string
): DateRange {
  const stillOut = isOnLoan(loan, today) && isOverdue(loan, today);
  return {
    endDate: stillOut ? today : loan.endDate,
    startDate: loan.startDate,
  };
}

export function canTransition(from: LoanStatus, to: LoanStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

const EVENTS: Partial<Record<LoanStatus, NotificationEvent>> = {
  approved: "request.approved",
  cancelled: "request.cancelled",
  declined: "request.declined",
  returned: "loan.returned",
};

/**
 * Who hears about a change: the borrower, except when the borrower cancelled,
 * in which case the owner does. System changes (no actor) go to the borrower.
 */
/** Who hears about a loan moving to `to` (shared with the demo seed). */
export function recipientOf(
  loan: Pick<Doc<"loans">, "borrowerId" | "ownerId">,
  to: LoanStatus,
  actorId?: Id<"users">
): Id<"users"> {
  return to === "cancelled" && actorId === loan.borrowerId
    ? loan.ownerId
    : loan.borrowerId;
}

/**
 * The single place a loan changes status, so every change is validated the
 * same way and emits exactly one notification event.
 */
export function isClosedStatus(status: LoanStatus) {
  return (CLOSED_LOAN_STATUSES as readonly LoanStatus[]).includes(status);
}

export async function transitionLoan(
  ctx: MutationCtx,
  loan: Doc<"loans">,
  to: LoanStatus,
  { actorId, now = Date.now() }: { actorId?: Id<"users">; now?: number } = {}
): Promise<void> {
  if (!canTransition(loan.status, to)) {
    fail("INVALID_TRANSITION", `A ${loan.status} loan cannot become ${to}.`);
  }
  await ctx.db.patch(loan._id, {
    status: to,
    ...(to === "returned" ? { returnedAt: now } : { decidedAt: now }),
    ...(isClosedStatus(to) ? { closedAt: now } : {}),
  });
  const event = EVENTS[to];
  if (event) {
    await enqueueNotification(
      ctx,
      loan._id,
      event,
      recipientOf(loan, to, actorId)
    );
  }
}
