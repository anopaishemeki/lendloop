import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { fail, requireAdmin } from "./auth";
import { mutation } from "./functions";
import { availabilityOf, availabilityValidator } from "./lib/availability";
import {
  deliveryCounts,
  loanCounts,
  reminderCounts,
  reportCounts,
  toolCounts,
  userCounts,
} from "./lib/counters";
import { addDays, DAY_MS, dayStartMs, todayUtc } from "./lib/dates";
import { cachedGet, mapPage } from "./lib/db";
import { isOverdue, overdueLoans } from "./lib/loans";
import { redriveFailedDeliveries } from "./lib/notifications";
import { isTrustedLender } from "./lib/users";
import {
  categoryValidator,
  conditionValidator,
  deliveryStatusValidator,
  LOAN_STATUSES,
  type LoanStatus,
  loanStatusValidator,
  notificationEventValidator,
  REMINDER_STATUSES,
  reminderStatusValidator,
  reportReasonValidator,
  reportStatusValidator,
  type ToolCategory,
  type ToolCondition,
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
  condition: conditionValidator,
  name: v.string(),
  owner: adminPersonView,
});

const adminUserView = v.object({
  _id: v.id("users"),
  isTrustedLender: v.boolean(),
  name: v.string(),
});

/** Newest first, except overdue loans: most overdue first. */
function loansByStatus(
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

type LoanFilters = {
  category?: ToolCategory;
  condition?: ToolCondition;
  search?: string;
  status?: LoanStatus | "overdue";
};

/**
 * Loans matching the filters. A tool-name search uses the search index
 * (best match first); otherwise status picks the index and the tool's category
 * and condition narrow it.
 */
function loansFiltered(
  ctx: QueryCtx,
  { category, condition, search, status }: LoanFilters,
  today: string
) {
  const text = search?.trim();
  if (text) {
    const matches = ctx.db
      .query("loans")
      .withSearchIndex("search_tool_name", (q) => {
        let matching = q.search("toolName", text);
        if (status) {
          matching = matching.eq(
            "status",
            status === "overdue" ? "approved" : status
          );
        }
        if (category) matching = matching.eq("toolCategory", category);
        if (condition) matching = matching.eq("toolCondition", condition);
        return matching;
      });
    return status === "overdue"
      ? matches.filter((q) => q.lt(q.field("endDate"), today))
      : matches;
  }

  const base = loansByStatus(ctx, status, today);
  if (!(category || condition)) return base;
  return base.filter((q) =>
    q.and(
      category ? q.eq(q.field("toolCategory"), category) : true,
      condition ? q.eq(q.field("toolCondition"), condition) : true
    )
  );
}

function toolNameOf(tool: Doc<"tools"> | null) {
  return tool?.name ?? "Removed tool";
}

/**
 * Loans, narrowed by status (including overdue), the borrowed tool's name,
 * category and condition. Newest first (overdue: most overdue first); with a
 * name search, best match first. Without a search, category and condition
 * filter the status scan, so a rare value can leave a page short: fine at this
 * size, and it avoids an index per combination.
 */
export const listLoans = query({
  args: {
    category: v.optional(categoryValidator),
    condition: v.optional(conditionValidator),
    paginationOpts: paginationOptsValidator,
    // Matched against the borrowed tool's name.
    search: v.optional(v.string()),
    // "overdue" narrows to approved loans past their end date.
    status: v.optional(v.union(loanStatusValidator, v.literal("overdue"))),
  },
  handler: async (ctx, { paginationOpts, ...filters }) => {
    await requireAdmin(ctx);
    const today = todayUtc();
    const result = await loansFiltered(ctx, filters, today).paginate(
      paginationOpts
    );

    const get = cachedGet(ctx);
    return await mapPage(result, async (loan) => {
      const [owner, borrower, toolName] = await Promise.all([
        get(loan.ownerId),
        get(loan.borrowerId),
        // The loan's copy, so the row shows the name a search matched.
        loan.toolName ?? get(loan.toolId).then(toolNameOf),
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
        toolName,
      };
    });
  },
  returns: paginationResultValidator(adminLoanView),
});

/** Live listings for the admin table: by name match, else newest first. */
function liveListings(
  ctx: QueryCtx,
  {
    category,
    condition,
    search,
  }: { category?: ToolCategory; condition?: ToolCondition; search?: string }
) {
  const text = search?.trim();
  if (text) {
    return ctx.db.query("tools").withSearchIndex("search_name", (q) => {
      const live = q.search("name", text).eq("removedAt", undefined);
      const inCategory = category ? live.eq("category", category) : live;
      return condition ? inCategory.eq("condition", condition) : inCategory;
    });
  }
  // The narrowest index for the filters given, newest first.
  const tools = ctx.db.query("tools");
  if (category && condition) {
    return tools
      .withIndex("by_category_condition_removed", (q) =>
        q
          .eq("category", category)
          .eq("condition", condition)
          .eq("removedAt", undefined)
      )
      .order("desc");
  }
  if (category) {
    return tools
      .withIndex("by_category_and_removed_at", (q) =>
        q.eq("category", category).eq("removedAt", undefined)
      )
      .order("desc");
  }
  if (condition) {
    return tools
      .withIndex("by_condition_and_removed_at", (q) =>
        q.eq("condition", condition).eq("removedAt", undefined)
      )
      .order("desc");
  }
  return tools
    .withIndex("by_removed_at", (q) => q.eq("removedAt", undefined))
    .order("desc");
}

/**
 * Live listings, filterable by name, category and condition, so an admin can
 * find and remove any via tools.remove.
 */
export const listTools = query({
  args: {
    category: v.optional(categoryValidator),
    condition: v.optional(conditionValidator),
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
  },
  handler: async (ctx, { paginationOpts, ...filters }) => {
    await requireAdmin(ctx);
    const result = await liveListings(ctx, filters).paginate(paginationOpts);
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
        condition: tool.condition,
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

const WEEK_DAYS = 7;
const HOUR_MS = 3_600_000;

const overviewView = v.object({
  listings: v.number(),
  loans: v.object(
    Object.fromEntries(
      LOAN_STATUSES.map((status) => [status, v.number()])
    ) as Record<LoanStatus, ReturnType<typeof v.number>>
  ),
  neighbors: v.number(),
  openReports: v.number(),
  overdue: v.number(),
  trustedLenders: v.number(),
});

/**
 * People, listings and loans for the admin overview, read from the counters
 * in convex/lib/counters.ts (maintained on every write), so it costs a few
 * reads however large the tables grow.
 */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // Four counter calls: users, tools, reports, and every loan figure in one batch.
    const open = { inclusive: true, key: "open" as const };
    const [
      [neighbors = 0, trustedLenders = 0],
      listings,
      openReports,
      loanTotals,
    ] = await Promise.all([
      userCounts.countBatch(ctx, [
        {},
        { bounds: { lower: { inclusive: true, key: 1 } } },
      ]),
      toolCounts.count(ctx, {
        bounds: { upper: { inclusive: true, key: 0 } },
      }),
      reportCounts.count(ctx, { bounds: { lower: open, upper: open } }),
      loanCounts.countBatch(ctx, [
        ...LOAN_STATUSES.map((namespace) => ({ namespace })),
        {
          bounds: { upper: { inclusive: false, key: todayUtc() } },
          namespace: "approved" as const,
        },
      ]),
    ]);
    const overdue = loanTotals[LOAN_STATUSES.length] ?? 0;
    return {
      listings,
      loans: Object.fromEntries(
        LOAN_STATUSES.map((status, i) => [status, loanTotals[i] ?? 0])
      ) as Record<LoanStatus, number>,
      neighbors,
      openReports,
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
    // Rounded to the hour so the bound (and the query's cache) stays stable.
    const weekAgo =
      Math.floor((Date.now() - WEEK_DAYS * DAY_MS) / HOUR_MS) * HOUR_MS;
    const [
      [deliveredThisWeek, queued, failed],
      [remindersSentThisWeek = 0, remindersFailedThisWeek = 0],
    ] = await Promise.all([
      deliveryCounts.countBatch(ctx, [
        {
          bounds: { lower: { inclusive: true, key: weekAgo } },
          namespace: "sent",
        },
        { namespace: "pending" },
        { namespace: "failed" },
      ]),
      reminderCounts.countBatch(
        ctx,
        REMINDER_STATUSES.map((namespace) => ({
          bounds: {
            lower: {
              inclusive: true,
              key: addDays(todayUtc(), 1 - WEEK_DAYS),
            },
          },
          namespace,
        }))
      ),
    ]);
    return {
      deliveredThisWeek: deliveredThisWeek ?? 0,
      failed: failed ?? 0,
      queued: queued ?? 0,
      // Reminders retry on their own (each hourly run, then daily), so they're
      // counted for the week rather than as an outstanding backlog.
      remindersFailedThisWeek,
      remindersSentThisWeek,
    };
  },
  returns: v.object({
    deliveredThisWeek: v.number(),
    // Request notifications currently failed (retry them from Automation).
    failed: v.number(),
    queued: v.number(),
    remindersFailedThisWeek: v.number(),
    remindersSentThisWeek: v.number(),
  }),
});

const OUTCOME_DAYS = 14;

const outcomeSeriesView = v.array(
  v.object({ day: v.string(), failed: v.number(), sent: v.number() })
);

/** Per-day [sent, failed] count queries against one counter, two per day. */
function sentAndFailedPerDay<K>(
  days: string[],
  bounds: (day: string) => {
    lower: { inclusive: boolean; key: K };
    upper: { inclusive: boolean; key: K };
  }
) {
  return days.flatMap((day) =>
    (["sent", "failed"] as const).map((namespace) => ({
      bounds: bounds(day),
      namespace,
    }))
  );
}

/** Pairs a flat [sent, failed, sent, failed, …] result back up by day. */
function toSeries(days: string[], counts: number[]) {
  return days.map((day, i) => ({
    day,
    failed: counts[2 * i + 1] ?? 0,
    sent: counts[2 * i] ?? 0,
  }));
}

/**
 * Sent and failed deliveries and reminders per UTC day for the last two
 * weeks, oldest first, read from the counters in two batched calls.
 * Deliveries are filed by when they were sent or gave up; reminders by their
 * reminder day.
 */
export const automationOutcomes = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const today = todayUtc();
    const days = Array.from({ length: OUTCOME_DAYS }, (_, i) =>
      addDays(today, i + 1 - OUTCOME_DAYS)
    );
    const [deliveries, reminders] = await Promise.all([
      deliveryCounts.countBatch(
        ctx,
        sentAndFailedPerDay(days, (day) => ({
          lower: { inclusive: true, key: dayStartMs(day) },
          upper: { inclusive: false, key: dayStartMs(day) + DAY_MS },
        }))
      ),
      reminderCounts.countBatch(
        ctx,
        sentAndFailedPerDay(days, (day) => ({
          lower: { inclusive: true, key: day },
          upper: { inclusive: true, key: day },
        }))
      ),
    ]);
    return {
      deliveries: toSeries(days, deliveries),
      reminders: toSeries(days, reminders),
    };
  },
  returns: v.object({
    deliveries: outcomeSeriesView,
    reminders: outcomeSeriesView,
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

const adminReportView = v.object({
  _creationTime: v.number(),
  _id: v.id("reports"),
  // Absent once the listing is removed.
  availability: v.optional(availabilityValidator),
  details: v.optional(v.string()),
  owner: adminPersonView,
  reason: reportReasonValidator,
  reporter: adminPersonView,
  status: reportStatusValidator,
  toolId: v.id("tools"),
  toolName: v.string(),
});

/** Listing reports, newest first; the queue defaults to open ones. */
export const listReports = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(reportStatusValidator),
  },
  handler: async (ctx, { paginationOpts, status }) => {
    await requireAdmin(ctx);
    const rows = status
      ? ctx.db
          .query("reports")
          .withIndex("by_status", (q) => q.eq("status", status))
      : ctx.db.query("reports");
    const result = await rows.order("desc").paginate(paginationOpts);
    const today = todayUtc();
    const get = cachedGet(ctx);
    return await mapPage(result, async (report) => {
      const [tool, reporter] = await Promise.all([
        get(report.toolId),
        get(report.reporterId),
      ]);
      const live = tool?.removedAt === undefined ? tool : null;
      const [owner, availability] = await Promise.all([
        tool ? get(tool.ownerId) : null,
        live ? availabilityOf(ctx, live._id, today) : undefined,
      ]);
      return {
        _creationTime: report._creationTime,
        _id: report._id,
        availability,
        details: report.details,
        owner: adminPerson(owner),
        reason: report.reason,
        reporter: adminPerson(reporter),
        status: report.status,
        toolId: report.toolId,
        toolName: toolNameOf(tool),
      };
    });
  },
  returns: paginationResultValidator(adminReportView),
});

/**
 * Closes one open report without action. To act on a report, remove the
 * listing (tools.remove), which closes every open report about it.
 */
export const dismissReport = mutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, { reportId }) => {
    const viewer = await requireAdmin(ctx);
    const report = await ctx.db.get(reportId);
    if (!report) fail("NOT_FOUND", "That report no longer exists.");
    if (report.status !== "open") {
      fail("INVALID_TRANSITION", "That report is already resolved.");
    }
    await ctx.db.patch(reportId, {
      resolvedAt: Date.now(),
      resolvedBy: viewer.user._id,
      status: "dismissed",
    });
    return null;
  },
  returns: v.null(),
});
