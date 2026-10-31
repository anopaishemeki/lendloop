import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { isClosedStatus } from "./lib/loans";

/**
 * One-off backfill of `closedAt` for loans that closed before the field
 * existed, so they show in board history. Safe to re-run. Pages through the
 * table; run until it reports done:
 *   npx convex run migrations:backfillClosedAt
 */
export const backfillClosedAt = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor = null }) => {
    const { continueCursor, isDone, page } = await ctx.db
      .query("loans")
      .paginate({ cursor, numItems: 200 });
    const missing = page.filter(
      (loan) => isClosedStatus(loan.status) && loan.closedAt === undefined
    );
    await Promise.all(
      missing.map((loan) =>
        ctx.db.patch(loan._id, {
          closedAt: loan.returnedAt ?? loan.decidedAt ?? loan._creationTime,
        })
      )
    );
    return { continueCursor, isDone, patched: missing.length };
  },
  returns: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
    patched: v.number(),
  }),
});
