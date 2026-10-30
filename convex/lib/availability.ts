import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { todayUtc } from "./dates";

export type Availability = "available" | "on_loan";

/**
 * A tool is on loan from the start date of an approved loan until the owner
 * marks it returned, so an overdue loan keeps the tool unavailable.
 */
export async function availabilityOf(
  ctx: QueryCtx,
  toolId: Id<"tools">,
  today = todayUtc()
): Promise<Availability> {
  const approved = await ctx.db
    .query("loans")
    .withIndex("by_tool_and_status", (q) =>
      q.eq("toolId", toolId).eq("status", "approved")
    )
    .collect();
  return approved.some((loan) => loan.startDate <= today)
    ? "on_loan"
    : "available";
}
