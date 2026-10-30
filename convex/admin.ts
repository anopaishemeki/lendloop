import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { fail, requireAdmin } from "./auth";
import { availabilityOf, availabilityValidator } from "./lib/availability";
import { todayUtc } from "./lib/dates";
import { cachedGet } from "./lib/db";
import { isOverdue } from "./lib/loans";
import {
  categoryValidator,
  LOAN_STATUSES,
  loanStatusValidator,
} from "./lib/validators";

const ADMIN_LIST_LIMIT = 200;

const adminLoanView = v.object({
  _creationTime: v.number(),
  _id: v.id("loans"),
  borrowerName: v.string(),
  endDate: v.string(),
  isOverdue: v.boolean(),
  ownerName: v.string(),
  startDate: v.string(),
  status: loanStatusValidator,
  toolName: v.string(),
});

const adminToolView = v.object({
  _id: v.id("tools"),
  availability: availabilityValidator,
  category: categoryValidator,
  name: v.string(),
  ownerName: v.string(),
});

const adminUserView = v.object({
  _id: v.id("users"),
  isTrustedLender: v.boolean(),
  name: v.string(),
});

function nameOf(user: Doc<"users"> | null) {
  return user?.name ?? "Unknown";
}

/** Every loan across the neighborhood, newest first, optionally by status. */
export const listLoans = query({
  args: { status: v.optional(loanStatusValidator) },
  handler: async (ctx, { status }) => {
    await requireAdmin(ctx);
    const statuses = status ? [status] : LOAN_STATUSES;
    const perStatus = await Promise.all(
      statuses.map((s) =>
        ctx.db
          .query("loans")
          .withIndex("by_status_and_end_date", (q) => q.eq("status", s))
          .order("desc")
          .take(ADMIN_LIST_LIMIT)
      )
    );
    const loans = perStatus
      .flat()
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, ADMIN_LIST_LIMIT);

    const today = todayUtc();
    const get = cachedGet(ctx);
    return await Promise.all(
      loans.map(async (loan) => {
        const [tool, owner, borrower] = await Promise.all([
          get(loan.toolId),
          get(loan.ownerId),
          get(loan.borrowerId),
        ]);
        return {
          _creationTime: loan._creationTime,
          _id: loan._id,
          borrowerName: nameOf(borrower),
          endDate: loan.endDate,
          isOverdue: isOverdue(loan, today),
          ownerName: nameOf(owner),
          startDate: loan.startDate,
          status: loan.status,
          toolName: tool?.name ?? "Removed tool",
        };
      })
    );
  },
  returns: v.array(adminLoanView),
});

/** All live listings so an admin can remove any of them via tools.remove. */
export const listTools = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_removed_at", (q) => q.eq("removedAt", undefined))
      .order("desc")
      .take(ADMIN_LIST_LIMIT);
    const today = todayUtc();
    const get = cachedGet(ctx);
    return await Promise.all(
      tools.map(async (tool) => ({
        _id: tool._id,
        availability: await availabilityOf(ctx, tool._id, today),
        category: tool.category,
        name: tool.name,
        ownerName: nameOf(await get(tool.ownerId)),
      }))
    );
  },
  returns: v.array(adminToolView),
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").take(ADMIN_LIST_LIMIT);
    return users
      .map(({ _id, isTrustedLender, name }) => ({ _id, isTrustedLender, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  returns: v.array(adminUserView),
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
