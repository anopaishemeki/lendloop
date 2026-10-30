import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { todayUtc } from "./dates";

export const availabilityValidator = v.union(
  v.literal("available"),
  v.literal("on_loan")
);

export type Availability = typeof availabilityValidator.type;

/**
 * A tool is out from the start date of an approved loan until the owner marks
 * it returned, so an overdue loan keeps the tool unavailable.
 */
export function isOnLoan(
  loan: Pick<Doc<"loans">, "status" | "startDate">,
  today: string
): boolean {
  return loan.status === "approved" && loan.startDate <= today;
}

export async function availabilityOf(
  ctx: QueryCtx,
  toolId: Id<"tools">,
  today = todayUtc()
): Promise<Availability> {
  const active = await ctx.db
    .query("loans")
    .withIndex("by_tool_and_status_and_start_date", (q) =>
      q.eq("toolId", toolId).eq("status", "approved").lte("startDate", today)
    )
    .first();
  return active ? "on_loan" : "available";
}
