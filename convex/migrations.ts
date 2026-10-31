import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./functions";
import { COUNTED_TABLES, COUNTERS, type CountedTable } from "./lib/counters";
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

/**
 * Counts one page of `table`'s rows created before `before` (later rows were
 * counted by the triggers), one at a time since they share a counter tree.
 * Small pages keep conflicts with live writes rare.
 */
async function fillPage<T extends CountedTable>(
  ctx: MutationCtx,
  table: T,
  before: number,
  cursor: string | null
) {
  // The default order is by creation time, so the first newer row ends it.
  const { continueCursor, isDone, page } = await ctx.db
    .query(table)
    .paginate({ cursor, numItems: 25 });
  const older = page.filter((doc) => doc._creationTime < before);
  for (const doc of older) {
    // biome-ignore lint/performance/noAwaitInLoops: the rows share one counter tree, so they're added one at a time.
    await COUNTERS[table].backfill(ctx, doc);
  }
  return { continueCursor, isDone: isDone || older.length < page.length };
}

/**
 * Loads every counted table into the admin overview counters, for rows written
 * before the counters existed (later writes keep them current). Run once after
 * deploying; it reschedules itself page by page until every table is done.
 * Safe to re-run.
 *   npx convex run migrations:backfillAllCounters
 */
export const backfillAllCounters = internalMutation({
  args: {
    // Rows created from this moment on are counted by the triggers.
    before: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
    tableIndex: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { before = Date.now(), cursor = null, tableIndex = 0 }
  ) => {
    const table = COUNTED_TABLES[tableIndex];
    if (!table) return null;
    const { continueCursor, isDone } = await fillPage(
      ctx,
      table,
      before,
      cursor
    );
    await ctx.scheduler.runAfter(0, internal.migrations.backfillAllCounters, {
      before,
      cursor: isDone ? null : continueCursor,
      tableIndex: isDone ? tableIndex + 1 : tableIndex,
    });
    return null;
  },
  returns: v.null(),
});
