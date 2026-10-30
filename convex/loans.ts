import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import {
  assertLoanParty,
  fail,
  isSelf,
  requireViewer,
  type Viewer,
} from "./auth";
import { isOnLoan } from "./lib/availability";
import {
  addDays,
  type DateRange,
  daysBetween,
  isIsoDate,
  rangesOverlap,
  todayUtc,
} from "./lib/dates";
import {
  blockedRange,
  isOverdue,
  loansForTool,
  transitionLoan,
} from "./lib/loans";
import { cleanText } from "./lib/text";
import { publicProfile, userLoader } from "./lib/users";
import {
  LOAN_MAX_ADVANCE_DAYS,
  LOAN_MAX_DAYS,
  LOAN_NOTE_MAX,
  type LoanStatus,
  loanStatusValidator,
} from "./lib/validators";

const HISTORY_LIMIT = 50;
const CLOSED_STATUSES = ["returned", "declined", "cancelled"] as const;

const loanView = v.object({
  _creationTime: v.number(),
  _id: v.id("loans"),
  canApprove: v.boolean(),
  canCancel: v.boolean(),
  canDecline: v.boolean(),
  canMarkReturned: v.boolean(),
  counterpart: v.object({
    firstName: v.string(),
    isTrustedLender: v.boolean(),
  }),
  endDate: v.string(),
  isOverdue: v.boolean(),
  note: v.optional(v.string()),
  role: v.union(v.literal("owner"), v.literal("borrower")),
  startDate: v.string(),
  status: loanStatusValidator,
  tool: v.object({
    _id: v.id("tools"),
    isRemoved: v.boolean(),
    name: v.string(),
  }),
});

export type LoanView = typeof loanView.type;

/** What the viewer may do next; mirrors the checks in the mutations below. */
function allowedActions(viewer: Viewer, loan: Doc<"loans">, today: string) {
  const isOwner = isSelf(viewer, loan.ownerId);
  const isBorrower = isSelf(viewer, loan.borrowerId);
  const notStarted = loan.startDate > today;
  return {
    canApprove: isOwner && loan.status === "requested" && loan.endDate >= today,
    canCancel:
      (isBorrower && loan.status === "requested") ||
      ((isOwner || isBorrower) && loan.status === "approved" && notStarted),
    canDecline: isOwner && loan.status === "requested",
    canMarkReturned: isOwner && isOnLoan(loan, today),
  };
}

function viewBuilder(ctx: QueryCtx, viewer: Viewer) {
  const today = todayUtc();
  const userOf = userLoader(ctx, viewer.user);
  return async (loan: Doc<"loans">): Promise<LoanView> => {
    const role = isSelf(viewer, loan.ownerId) ? "owner" : "borrower";
    const [tool, counterpart] = await Promise.all([
      ctx.db.get(loan.toolId),
      userOf(role === "owner" ? loan.borrowerId : loan.ownerId),
    ]);
    return {
      _creationTime: loan._creationTime,
      _id: loan._id,
      ...allowedActions(viewer, loan, today),
      counterpart: publicProfile(counterpart),
      endDate: loan.endDate,
      isOverdue: isOverdue(loan, today),
      note: loan.note,
      role,
      startDate: loan.startDate,
      status: loan.status,
      tool: {
        _id: loan.toolId,
        isRemoved: tool?.removedAt !== undefined,
        name: tool?.name ?? "Removed tool",
      },
    };
  };
}

function validateRange(range: DateRange, today: string) {
  const { startDate, endDate } = range;
  if (!(isIsoDate(startDate) && isIsoDate(endDate))) {
    fail("INVALID_ARGUMENT", "Dates must be valid calendar days.");
  }
  // Dates are UTC days; one day of slack lets people west of UTC pick their
  // local "today" in the evening.
  if (startDate < addDays(today, -1)) {
    fail("INVALID_ARGUMENT", "The loan can't start in the past.");
  }
  if (endDate < startDate) {
    fail("INVALID_ARGUMENT", "The return date must be on or after the start.");
  }
  if (daysBetween(startDate, endDate) + 1 > LOAN_MAX_DAYS) {
    fail("INVALID_ARGUMENT", `Loans can last at most ${LOAN_MAX_DAYS} days.`);
  }
  if (startDate > addDays(today, LOAN_MAX_ADVANCE_DAYS)) {
    fail(
      "INVALID_ARGUMENT",
      `Requests can be made up to ${LOAN_MAX_ADVANCE_DAYS} days ahead.`
    );
  }
}

async function assertNoApprovedOverlap(
  ctx: QueryCtx,
  toolId: Id<"tools">,
  range: DateRange,
  ignore?: Id<"loans">
) {
  const today = todayUtc();
  const approved = await loansForTool(ctx, toolId, "approved");
  const clash = approved.some(
    (loan) =>
      loan._id !== ignore && rangesOverlap(blockedRange(loan, today), range)
  );
  if (clash) {
    fail("CONFLICT", "The tool is already lent out for some of those dates.");
  }
}

async function loadLoan(ctx: MutationCtx, loanId: Id<"loans">) {
  const loan = await ctx.db.get(loanId);
  if (!loan) fail("NOT_FOUND", "That request no longer exists.");
  return loan;
}

/**
 * Open loans are always returned in full so none can drop off the board; only
 * closed history is capped.
 */
async function loansForParty(
  ctx: QueryCtx,
  index: "by_owner_and_status" | "by_borrower_and_status",
  userId: Id<"users">
) {
  const field = index === "by_owner_and_status" ? "ownerId" : "borrowerId";
  const byStatus = (status: LoanStatus) =>
    ctx.db
      .query("loans")
      .withIndex(index, (q) => q.eq(field, userId).eq("status", status))
      .order("desc");
  const [requested, approved, ...closed] = await Promise.all([
    byStatus("requested").collect(),
    byStatus("approved").collect(),
    ...CLOSED_STATUSES.map((status) => byStatus(status).take(HISTORY_LIMIT)),
  ]);
  const history = closed
    .flat()
    .sort((a, b) => b._creationTime - a._creationTime)
    .slice(0, HISTORY_LIMIT);
  return [...requested, ...approved, ...history];
}

export const request = mutation({
  args: {
    endDate: v.string(),
    note: v.optional(v.string()),
    startDate: v.string(),
    toolId: v.id("tools"),
  },
  handler: async (ctx, { toolId, startDate, endDate, note }) => {
    const viewer = await requireViewer(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool || tool.removedAt !== undefined) {
      fail("NOT_FOUND", "That tool is no longer listed.");
    }
    if (isSelf(viewer, tool.ownerId)) {
      fail("FORBIDDEN", "You can't borrow your own tool.");
    }
    const range = { endDate, startDate };
    validateRange(range, todayUtc());
    await assertNoApprovedOverlap(ctx, toolId, range);

    const pending = await loansForTool(ctx, toolId, "requested");
    if (
      pending.some(
        (l) => isSelf(viewer, l.borrowerId) && rangesOverlap(l, range)
      )
    ) {
      fail("CONFLICT", "You already have a pending request for those dates.");
    }

    const cleanNote = note ? cleanText(note, "Note", 0, LOAN_NOTE_MAX) : "";
    return await ctx.db.insert("loans", {
      borrowerId: viewer.user._id,
      endDate,
      ownerId: tool.ownerId,
      startDate,
      status: "requested",
      toolId,
      ...(cleanNote ? { note: cleanNote } : {}),
    });
  },
  returns: v.id("loans"),
});

/** Approving also declines other pending requests for overlapping dates. */
export const approve = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const viewer = await requireViewer(ctx);
    const loan = await loadLoan(ctx, loanId);
    assertLoanParty(viewer, loan, "owner");
    if (loan.status === "requested" && loan.endDate < todayUtc()) {
      fail(
        "CONFLICT",
        "Those dates have passed. Decline this request instead."
      );
    }
    const tool = await ctx.db.get(loan.toolId);
    if (!tool || tool.removedAt !== undefined) {
      fail("CONFLICT", "This tool is no longer listed.");
    }
    await assertNoApprovedOverlap(ctx, loan.toolId, loan, loan._id);

    const now = Date.now();
    await transitionLoan(ctx, loan, "approved", now);
    const pending = await loansForTool(ctx, loan.toolId, "requested");
    await Promise.all(
      pending
        .filter((other) => rangesOverlap(other, loan))
        .map((other) => transitionLoan(ctx, other, "declined", now))
    );
    return null;
  },
  returns: v.null(),
});

export const decline = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const viewer = await requireViewer(ctx);
    const loan = await loadLoan(ctx, loanId);
    assertLoanParty(viewer, loan, "owner");
    if (loan.status !== "requested") {
      fail("INVALID_TRANSITION", "Only pending requests can be declined.");
    }
    await transitionLoan(ctx, loan, "declined");
    return null;
  },
  returns: v.null(),
});

export const cancel = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const viewer = await requireViewer(ctx);
    const loan = await loadLoan(ctx, loanId);
    assertLoanParty(viewer, loan, "owner", "borrower");
    if (!allowedActions(viewer, loan, todayUtc()).canCancel) {
      fail(
        "INVALID_TRANSITION",
        loan.status === "approved"
          ? "This loan has started. Mark it returned instead."
          : "This request can't be cancelled."
      );
    }
    await transitionLoan(ctx, loan, "cancelled");
    return null;
  },
  returns: v.null(),
});

/** Works even if the tool was removed meanwhile, so a lent tool can always come back. */
export const markReturned = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const viewer = await requireViewer(ctx);
    const loan = await loadLoan(ctx, loanId);
    assertLoanParty(viewer, loan, "owner");
    if (!isOnLoan(loan, todayUtc())) {
      fail(
        "INVALID_TRANSITION",
        loan.status === "approved"
          ? "This loan hasn't started yet. Cancel it instead."
          : "Only loans that are out can be marked returned."
      );
    }
    await transitionLoan(ctx, loan, "returned");
    return null;
  },
  returns: v.null(),
});

export const listMyRequests = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const loans = await loansForParty(
      ctx,
      "by_borrower_and_status",
      viewer.user._id
    );
    return await Promise.all(loans.map(viewBuilder(ctx, viewer)));
  },
  returns: v.array(loanView),
});

export const listIncoming = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const loans = await loansForParty(
      ctx,
      "by_owner_and_status",
      viewer.user._id
    );
    return await Promise.all(loans.map(viewBuilder(ctx, viewer)));
  },
  returns: v.array(loanView),
});

/** Dates already promised to someone, so borrowers can pick free ones. No borrower data. */
export const bookedRanges = query({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    await requireViewer(ctx);
    const today = todayUtc();
    const approved = await loansForTool(ctx, toolId, "approved");
    return approved
      .map((loan) => blockedRange(loan, today))
      .filter((range) => range.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  },
  returns: v.array(v.object({ endDate: v.string(), startDate: v.string() })),
});
