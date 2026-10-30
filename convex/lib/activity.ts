import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  deliveryStatusValidator,
  notificationEventValidator,
} from "./validators";

const ACTIVITY_LIMIT = 4;

/** Automation history for one loan: emails sent by n8n and overdue reminders. */
export const activityValidator = v.object({
  at: v.number(),
  kind: v.union(notificationEventValidator, v.literal("overdue.reminder")),
  status: deliveryStatusValidator,
  toViewer: v.boolean(),
});

export type Activity = typeof activityValidator.type;

/**
 * Most recent automation first. Only the event type, outcome and time are
 * exposed; error text stays server-side.
 */
export async function loanActivity(
  ctx: QueryCtx,
  loanId: Id<"loans">,
  loan: { borrowerId: Id<"users"> },
  viewerId: Id<"users">
): Promise<Activity[]> {
  const [notifications, reminders] = await Promise.all([
    ctx.db
      .query("notificationOutbox")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .order("desc")
      .take(ACTIVITY_LIMIT),
    ctx.db
      .query("reminders")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .order("desc")
      .take(ACTIVITY_LIMIT),
  ]);
  const items: Activity[] = [
    ...notifications.map((n) => ({
      at: n.sentAt ?? n._creationTime,
      kind: n.event,
      status: n.status,
      toViewer: n.recipientId === viewerId,
    })),
    ...reminders.map((r) => ({
      at: r._creationTime,
      kind: "overdue.reminder" as const,
      status: r.status,
      toViewer: loan.borrowerId === viewerId,
    })),
  ];
  return items.sort((a, b) => b.at - a.at).slice(0, ACTIVITY_LIMIT);
}
