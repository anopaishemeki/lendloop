import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";
import { fail, requireAdmin } from "./auth";
import { availabilityOf, availabilityValidator } from "./lib/availability";
import { addDays, DAY_MS, todayUtc } from "./lib/dates";
import { cachedGet, mapPage } from "./lib/db";
import { isOverdue, overdueLoans } from "./lib/loans";
import { redriveFailedDeliveries } from "./lib/notifications";
import { isTrustedLender } from "./lib/users";
import {
  COUNT_CAP,
  categoryValidator,
  type DeliveryStatus,
  deliveryStatusValidator,
  LOAN_STATUSES,
  type LoanStatus,
  loanStatusValidator,
  notificationEventValidator,
  reminderStatusValidator,
} from "./lib/validators";

// Admins see full names (not just first names) so they can tell people apart.
const adminPersonView = v.object({
  isTrustedLender: v.boolean(),
  name: v.string(),
});

function adminPerson(user: Doc<"users"> | null) {
  return {
    isTrustedLender: isTrustedLender(user),
    name: user?.name ?? "Unknown",
  };
}

const adminLoanView = v.object({
  _creationTime: v.number(),
  _id: v.id("loans"),
  borrower: adminPersonView,
  endDate: v.string(),
  isOverdue: v.boolean(),
  owner: adminPersonView,
  startDate: v.string(),
  status: loanStatusValidator,
  toolName: v.string(),
});

const adminToolView = v.object({
  _id: v.id("tools"),
  availability: availabilityValidator,
  category: categoryValidator,
  name: v.string(),
  owner: adminPersonView,
});

const adminUserView = v.object({
  _id: v.id("users"),
  isTrustedLender: v.boolean(),
  name: v.string(),
});

/** Newest first, except overdue loans: most overdue first. */
function loansFiltered(
  ctx: QueryCtx,
  status: LoanStatus | "overdue" | undefined,
  today: string
) {
  if (status === "overdue") return overdueLoans(ctx, today).order("asc");
  if (!status) return ctx.db.query("loans").order("desc");
  return ctx.db
    .query("loans")
    .withIndex("by_status", (q) => q.eq("status", status))
    .order("desc");
}

function toolNameOf(tool: Doc<"tools"> | null) {
  return tool?.name ?? "Removed tool";
}

/** Every loan, newest first, optionally narrowed to one status. */
export const listLoans = query({
  args: {
    // "overdue" narrows to approved loans past their end date.
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.union(loanStatusValidator, v.literal("overdue"))),
  },
  handler: async (ctx, { paginationOpts, status }) => {
    await requireAdmin(ctx);
    const today = todayUtc();
    const result = await loansFiltered(ctx, status, today).paginate(
      paginationOpts
    );

    const get = cachedGet(ctx);
    return await mapPage(result, async (loan) => {
      const [tool, owner, borrower] = await Promise.all([
        get(loan.toolId),
        get(loan.ownerId),
        get(loan.borrowerId),
      ]);
      return {
        _creationTime: loan._creationTime,
        _id: loan._id,
        borrower: adminPerson(borrower),
        endDate: loan.endDate,
        isOverdue: isOverdue(loan, today),
        owner: adminPerson(owner),
        startDate: loan.startDate,
        status: loan.status,
        toolName: toolNameOf(tool),
      };
    });
  },
  returns: paginationResultValidator(adminLoanView),
});

/** All live listings, newest first, so an admin can remove any via tools.remove. */
export const listTools = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    const result = await ctx.db
      .query("tools")
      .withIndex("by_removed_at", (q) => q.eq("removedAt", undefined))
      .order("desc")
      .paginate(paginationOpts);
    const today = todayUtc();
    const get = cachedGet(ctx);
    return await mapPage(result, async (tool) => {
      const [owner, availability] = await Promise.all([
        get(tool.ownerId),
        availabilityOf(ctx, tool._id, today),
      ]);
      return {
        _id: tool._id,
        availability,
        category: tool.category,
        name: tool.name,
        owner: adminPerson(owner),
      };
    });
  },
  returns: paginationResultValidator(adminToolView),
});

/** Every neighbor, alphabetically. */
export const listUsers = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    const result = await ctx.db
      .query("users")
      .withIndex("by_name")
      .paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((user) => ({
        _id: user._id,
        isTrustedLender: user.isTrustedLender,
        name: user.name,
      })),
    };
  },
  returns: paginationResultValidator(adminUserView),
});

export const setTrustedLender = mutation({
  args: { trusted: v.boolean(), userId: v.id("users") },
  handler: async (ctx, { trusted, userId }) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get(userId);
    if (!user) fail("NOT_FOUND", "That neighbor no longer exists.");
    if (user.isTrustedLender !== trusted) {
      await ctx.db.patch(userId, { isTrustedLender: trusted });
    }
    return null;
  },
  returns: v.null(),
});

/**
 * Overview counts read at most COUNT_CAP rows each, so they stay within
 * Convex's read limits; the UI shows "1,000+". They're reactive, so writes to
 * the counted tables re-run them: production would keep counters (see README).
 */
const WEEK_DAYS = 7;

function countUpTo(rows: { take: (n: number) => Promise<unknown[]> }) {
  return rows.take(COUNT_CAP + 1).then((page) => page.length);
}

const overviewView = v.object({
  listings: v.number(),
  loans: v.object(
    Object.fromEntries(
      LOAN_STATUSES.map((status) => [status, v.number()])
    ) as Record<LoanStatus, ReturnType<typeof v.number>>
  ),
  neighbors: v.number(),
  overdue: v.number(),
  trustedLenders: v.number(),
});

/** People, listings and loans for the admin overview. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [neighbors, trustedLenders, listings, overdue, ...loanCounts] =
      await Promise.all([
        countUpTo(ctx.db.query("users")),
        countUpTo(
          ctx.db
            .query("users")
            .withIndex("by_trusted_lender", (q) =>
              q.eq("isTrustedLender", true)
            )
        ),
        countUpTo(
          ctx.db
            .query("tools")
            .withIndex("by_removed_at", (q) => q.eq("removedAt", undefined))
        ),
        countUpTo(overdueLoans(ctx, todayUtc())),
        ...LOAN_STATUSES.map((status) =>
          countUpTo(
            ctx.db
              .query("loans")
              .withIndex("by_status", (q) => q.eq("status", status))
          )
        ),
      ]);
    return {
      listings,
      loans: Object.fromEntries(
        LOAN_STATUSES.map((status, i) => [status, loanCounts[i] ?? 0])
      ) as Record<LoanStatus, number>,
      neighbors,
      overdue,
      trustedLenders,
    };
  },
  returns: overviewView,
});

/**
 * Delivery and reminder counts, kept apart from `overview` so delivery retries
 * only re-run this small query.
 */
export const automationHealth = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const deliveries = (status: DeliveryStatus, since = 0) =>
      countUpTo(
        ctx.db
          .query("notificationOutbox")
          .withIndex("by_status", (q) =>
            q.eq("status", status).gte("_creationTime", since)
          )
      );
    const [deliveredThisWeek, queued, failed, remindersThisWeek] =
      await Promise.all([
        deliveries("sent", Date.now() - WEEK_DAYS * DAY_MS),
        deliveries("pending"),
        deliveries("failed"),
        countUpTo(
          ctx.db
            .query("reminders")
            .withIndex("by_reminder_date", (q) =>
              q.gte("reminderDate", addDays(todayUtc(), 1 - WEEK_DAYS))
            )
        ),
      ]);
    return { deliveredThisWeek, failed, queued, remindersThisWeek };
  },
  returns: v.object({
    deliveredThisWeek: v.number(),
    failed: v.number(),
    queued: v.number(),
    remindersThisWeek: v.number(),
  }),
});

const adminNotificationView = v.object({
  _creationTime: v.number(),
  _id: v.id("notificationOutbox"),
  attempts: v.number(),
  event: notificationEventValidator,
  lastError: v.optional(v.string()),
  recipient: adminPersonView,
  sentAt: v.optional(v.number()),
  status: deliveryStatusValidator,
  toolName: v.string(),
});

/** Request-notification deliveries to n8n, newest first. */
export const listNotifications = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(deliveryStatusValidator),
  },
  handler: async (ctx, { paginationOpts, status }) => {
    await requireAdmin(ctx);
    const rows = status
      ? ctx.db
          .query("notificationOutbox")
          .withIndex("by_status", (q) => q.eq("status", status))
      : ctx.db.query("notificationOutbox");
    const result = await rows.order("desc").paginate(paginationOpts);
    const get = cachedGet(ctx);
    return await mapPage(result, async (entry) => {
      const [loan, recipient] = await Promise.all([
        get(entry.loanId),
        get(entry.recipientId),
      ]);
      const tool = loan ? await get(loan.toolId) : null;
      return {
        _creationTime: entry._creationTime,
        _id: entry._id,
        attempts: entry.attempts,
        event: entry.event,
        lastError: entry.lastError,
        recipient: adminPerson(recipient),
        sentAt: entry.sentAt,
        status: entry.status,
        toolName: toolNameOf(tool),
      };
    });
  },
  returns: paginationResultValidator(adminNotificationView),
});

const adminReminderView = v.object({
  _id: v.id("reminders"),
  borrower: adminPersonView,
  error: v.optional(v.string()),
  reminderDate: v.string(),
  status: reminderStatusValidator,
  toolName: v.string(),
  updatedAt: v.number(),
});

/** Overdue reminders that n8n wrote back, newest first. */
export const listReminders = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    const result = await ctx.db
      .query("reminders")
      .order("desc")
      .paginate(paginationOpts);
    const get = cachedGet(ctx);
    return await mapPage(result, async (reminder) => {
      const loan = await get(reminder.loanId);
      const [tool, borrower] = loan
        ? await Promise.all([get(loan.toolId), get(loan.borrowerId)])
        : [null, null];
      return {
        _id: reminder._id,
        borrower: adminPerson(borrower),
        error: reminder.error,
        reminderDate: reminder.reminderDate,
        status: reminder.status,
        toolName: toolNameOf(tool),
        updatedAt: reminder.updatedAt,
      };
    });
  },
  returns: paginationResultValidator(adminReminderView),
});

/** Re-sends every failed request notification once n8n is healthy again. */
export const retryFailedNotifications = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await redriveFailedDeliveries(ctx);
  },
  returns: v.number(),
});
