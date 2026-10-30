import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { fail, requireAdmin } from "./auth";
import { availabilityOf, availabilityValidator } from "./lib/availability";
import { todayUtc } from "./lib/dates";
import { cachedGet } from "./lib/db";
import { isOverdue } from "./lib/loans";
import { categoryValidator, loanStatusValidator } from "./lib/validators";

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

// Admins see full names (not just first names) so they can tell people apart.
function nameOf(user: Doc<"users"> | null) {
  return user?.name ?? "Unknown";
}

/** Every loan, newest first, optionally narrowed to one status. */
export const listLoans = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(loanStatusValidator),
  },
  handler: async (ctx, { paginationOpts, status }) => {
    await requireAdmin(ctx);
    const loans = status
      ? ctx.db
          .query("loans")
          .withIndex("by_status", (q) => q.eq("status", status))
      : ctx.db.query("loans");
    const result = await loans.order("desc").paginate(paginationOpts);

    const today = todayUtc();
    const get = cachedGet(ctx);
    const page = await Promise.all(
      result.page.map(async (loan) => {
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
    return { ...result, page };
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
    const page = await Promise.all(
      result.page.map(async (tool) => {
        const [owner, availability] = await Promise.all([
          get(tool.ownerId),
          availabilityOf(ctx, tool._id, today),
        ]);
        return {
          _id: tool._id,
          availability,
          category: tool.category,
          name: tool.name,
          ownerName: nameOf(owner),
        };
      })
    );
    return { ...result, page };
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
      page: result.page.map(({ _id, isTrustedLender, name }) => ({
        _id,
        isTrustedLender,
        name,
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
