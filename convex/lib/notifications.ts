import { Workpool } from "@convex-dev/workpool";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { type NotificationEvent, REDRIVE_LIMIT } from "./validators";

/**
 * Retries back off 10s, 30s, 90s, 4.5min, 13.5min: about 20 minutes in all,
 * long enough to ride out an n8n restart. Retrying is safe because n8n sends
 * the email with a Resend idempotency key derived from the event id.
 */
export const notificationPool = new Workpool(components.notificationPool, {
  defaultRetryBehavior: { base: 3, initialBackoffMs: 10_000, maxAttempts: 6 },
  maxParallelism: 5,
  retryActionsByDefault: true,
});

export function scheduleDelivery(
  ctx: MutationCtx,
  outboxId: Id<"notificationOutbox">
) {
  return notificationPool.enqueueAction(
    ctx,
    internal.notifications.deliver,
    { outboxId },
    { context: { outboxId }, onComplete: internal.notifications.onDelivered }
  );
}

/** Records the event in the outbox and hands delivery to the retrying pool. */
export async function enqueueNotification(
  ctx: MutationCtx,
  loanId: Id<"loans">,
  event: NotificationEvent,
  recipientId: Id<"users">
): Promise<void> {
  const outboxId = await ctx.db.insert("notificationOutbox", {
    attempts: 0,
    event,
    loanId,
    recipientId,
    status: "pending",
  });
  await scheduleDelivery(ctx, outboxId);
}

/**
 * Puts failed deliveries back on the pool in batches of REDRIVE_LIMIT. A full
 * batch schedules the next one, so one call drains them all. Returns how many
 * this batch re-queued. `attempts` keeps counting across redrives.
 */
export async function redriveFailedDeliveries(ctx: MutationCtx) {
  const failed = await ctx.db
    .query("notificationOutbox")
    .withIndex("by_status", (q) => q.eq("status", "failed"))
    .take(REDRIVE_LIMIT);
  await Promise.all(
    failed.map(async (entry) => {
      await ctx.db.patch(entry._id, {
        lastError: undefined,
        status: "pending",
      });
      await scheduleDelivery(ctx, entry._id);
    })
  );
  if (failed.length === REDRIVE_LIMIT) {
    await ctx.scheduler.runAfter(0, internal.notifications.redriveFailed, {});
  }
  return failed.length;
}
