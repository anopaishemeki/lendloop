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
  type LoanParty,
  requireViewer,
  type Viewer,
} from "./auth";
import { activityValidator, loanActivity } from "./lib/activity";
import { isOnLoan } from "./lib/availability";
import {
  addDays,
  type DateRange,
  daysBetween,
  isIsoDate,
  rangesOverlap,
  todayUtc,
} from "./lib/dates";
import { cachedGet, getActiveTool } from "./lib/db";
import {
  blockedRange,
  isOverdue,
  loansForTool,
  transitionLoan,
} from "./lib/loans";
import { enqueueNotification } from "./lib/notifications";
import { cleanText } from "./lib/text";
import { publicProfile } from "./lib/users";
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
  activity: v.array(activityValidator),
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

const loanBoard = v.object({
  active: v.array(loanView),
  history: v.array(loanView),
  pending: v.array(loanView),
});

export type LoanView = typeof loanView.type;

/** The one definition of who may do what; mutations and the UI both use it. */
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
  const get = cachedGet(ctx, viewer.user);
  return async (loan: Doc<"loans">): Promise<LoanView> => {
    const role = isSelf(viewer, loan.ownerId) ? "owner" : "borrower";
    const [tool, counterpart, activity] = await Promise.all([
      get(loan.toolId),
      get(role === "owner" ? loan.borrowerId : loan.ownerId),
      loanActivity(ctx, loan._id, loan, viewer.user._id),
    ]);
    return {
      _creationTime: loan._creationTime,
      _id: loan._id,
      activity,
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

function assertNoApprovedOverlap(
  approved: Doc<"loans">[],
  range: DateRange,
  today: string,
  ignore?: Id<"loans">
) {
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

/** Loads the loan and checks the caller is a party allowed to take `action`. */
async function loadForAction(
  ctx: MutationCtx,
  loanId: Id<"loans">,
  action: keyof ReturnType<typeof allowedActions>,
  refusal: (loan: Doc<"loans">) => string
) {
  const viewer = await requireViewer(ctx);
  const loan = await loadLoan(ctx, loanId);
  const parties: LoanParty[] =
    action === "canCancel" ? ["owner", "borrower"] : ["owner"];
  assertLoanParty(viewer, loan, ...parties);
  const today = todayUtc();
  if (!allowedActions(viewer, loan, today)[action]) {
    fail("INVALID_TRANSITION", refusal(loan));
  }
  return { loan, today, viewer };
}

/**
 * Open loans are always returned in full so none can drop off the board; only
 * closed history is capped.
 */
async function boardFor(ctx: QueryCtx, viewer: Viewer, role: LoanView["role"]) {
  const userId = viewer.user._id;
  const byStatus = (status: LoanStatus) =>
    role === "owner"
      ? ctx.db
          .query("loans")
          .withIndex("by_owner_and_status", (q) =>
            q.eq("ownerId", userId).eq("status", status)
          )
          .order("desc")
      : ctx.db
          .query("loans")
          .withIndex("by_borrower_and_status", (q) =>
            q.eq("borrowerId", userId).eq("status", status)
          )
          .order("desc");
  const [pending, active, ...closed] = await Promise.all([
    byStatus("requested").collect(),
    byStatus("approved").collect(),
    ...CLOSED_STATUSES.map((status) => byStatus(status).take(HISTORY_LIMIT)),
  ]);
  const history = closed
    .flat()
    .sort((a, b) => b._creationTime - a._creationTime)
    .slice(0, HISTORY_LIMIT);

  const toView = viewBuilder(ctx, viewer);
  const views = (loans: Doc<"loans">[]) => Promise.all(loans.map(toView));
  const [pendingViews, activeViews, historyViews] = await Promise.all([
    views(pending),
    views(active),
    views(history),
  ]);
  return { active: activeViews, history: historyViews, pending: pendingViews };
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
    const today = todayUtc();
    const range = { endDate, startDate };
    validateRange(range, today);
    const [tool, approved, pending] = await Promise.all([
      getActiveTool(ctx, toolId),
      loansForTool(ctx, toolId, "approved"),
      loansForTool(ctx, toolId, "requested"),
    ]);
    if (isSelf(viewer, tool.ownerId)) {
      fail("FORBIDDEN", "You can't borrow your own tool.");
    }
    assertNoApprovedOverlap(approved, range, today);
    if (
      pending.some(
        (l) => isSelf(viewer, l.borrowerId) && rangesOverlap(l, range)
      )
    ) {
      fail("CONFLICT", "You already have a pending request for those dates.");
    }

    const cleanNote = note ? cleanText(note, "Note", 0, LOAN_NOTE_MAX) : "";
    const loanId = await ctx.db.insert("loans", {
      borrowerId: viewer.user._id,
      endDate,
      ownerId: tool.ownerId,
      startDate,
      status: "requested",
      toolId,
      ...(cleanNote ? { note: cleanNote } : {}),
    });
    await enqueueNotification(ctx, loanId, "request.created", tool.ownerId);
    return loanId;
  },
  returns: v.id("loans"),
});

/** Approving also declines other pending requests for overlapping dates. */
export const approve = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const { loan, today, viewer } = await loadForAction(
      ctx,
      loanId,
      "canApprove",
      (l) =>
        l.status === "requested"
          ? "Those dates have passed. Decline this request instead."
          : `A ${l.status} loan cannot become approved.`
    );
    const [, approved, pending] = await Promise.all([
      getActiveTool(ctx, loan.toolId),
      loansForTool(ctx, loan.toolId, "approved"),
      loansForTool(ctx, loan.toolId, "requested"),
    ]);
    assertNoApprovedOverlap(approved, loan, today, loan._id);

    const now = Date.now();
    const actorId = viewer.user._id;
    await transitionLoan(ctx, loan, "approved", { actorId, now });
    await Promise.all(
      pending
        .filter((other) => other._id !== loan._id && rangesOverlap(other, loan))
        .map((other) =>
          transitionLoan(ctx, other, "declined", { actorId, now })
        )
    );
    return null;
  },
  returns: v.null(),
});

export const decline = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const { loan, viewer } = await loadForAction(
      ctx,
      loanId,
      "canDecline",
      () => "Only pending requests can be declined."
    );
    await transitionLoan(ctx, loan, "declined", {
      actorId: viewer.user._id,
    });
    return null;
  },
  returns: v.null(),
});

export const cancel = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const { loan, viewer } = await loadForAction(
      ctx,
      loanId,
      "canCancel",
      (l) =>
        l.status === "approved"
          ? "This loan has started. Mark it returned instead."
          : "This request can't be cancelled."
    );
    await transitionLoan(ctx, loan, "cancelled", {
      actorId: viewer.user._id,
    });
    return null;
  },
  returns: v.null(),
});

/** Works even if the tool was removed meanwhile, so a lent tool can always come back. */
export const markReturned = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const { loan, viewer } = await loadForAction(
      ctx,
      loanId,
      "canMarkReturned",
      (l) =>
        l.status === "approved"
          ? "This loan hasn't started yet. Cancel it instead."
          : "Only loans that are out can be marked returned."
    );
    await transitionLoan(ctx, loan, "returned", {
      actorId: viewer.user._id,
    });
    return null;
  },
  returns: v.null(),
});

export const listMyRequests = query({
  args: {},
  handler: async (ctx) => boardFor(ctx, await requireViewer(ctx), "borrower"),
  returns: loanBoard,
});

export const listIncoming = query({
  args: {},
  handler: async (ctx) => boardFor(ctx, await requireViewer(ctx), "owner"),
  returns: loanBoard,
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
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  },
  returns: v.array(v.object({ endDate: v.string(), startDate: v.string() })),
});
