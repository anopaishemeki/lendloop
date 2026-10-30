import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  deliveryStatusValidator,
  notificationEventValidator,
} from "./validators";

const ACTIVITY_LIMIT = 4;

/** Automation history for one loan: emails sent by n8n and overdue reminders. */
export const activityValidator = v.object({
  at: v.number(),
  id: v.string(),
  kind: v.union(notificationEventValidator, v.literal("overdue.reminder")),
  status: deliveryStatusValidator,
  toViewer: v.boolean(),
});

export type Activity = typeof activityValidator.type;

/**
 * Most recent automation first, ordered by when each event happened. `at` is
 * the delivery time once sent. Only the event type, outcome and time are
 * exposed; error text stays server-side.
 */
export async function loanActivity(
  ctx: QueryCtx,
  loan: Pick<Doc<"loans">, "_id" | "borrowerId">,
  viewerId: Id<"users">
): Promise<Activity[]> {
  const [notifications, reminders] = await Promise.all([
    ctx.db
      .query("notificationOutbox")
      .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
      .order("desc")
      .take(ACTIVITY_LIMIT),
    ctx.db
      .query("reminders")
      .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
      .order("desc")
      .take(ACTIVITY_LIMIT),
  ]);
  const items = [
    ...notifications.map((n) => ({
      happened: n._creationTime,
      item: {
        at: n.sentAt ?? n._creationTime,
        id: n._id,
        kind: n.event,
        status: n.status,
        toViewer: n.recipientId === viewerId,
      },
    })),
    ...reminders.map((r) => ({
      happened: r._creationTime,
      item: {
        at: r.updatedAt,
        id: r._id,
        kind: "overdue.reminder" as const,
        status: r.status,
        toViewer: loan.borrowerId === viewerId,
      },
    })),
  ];
  return items
    .sort((a, b) => b.happened - a.happened)
    .slice(0, ACTIVITY_LIMIT)
    .map(({ item }) => item);
}
