import { Workpool } from "@convex-dev/workpool";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { NotificationEvent } from "./validators";

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
