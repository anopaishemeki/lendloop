import { NonRetryableError, vOnCompleteArgs } from "@convex-dev/workpool";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { internalMutation } from "./functions";
import { noteFailure } from "./lib/alerts";
import { appUrl as appUrlFromEnv } from "./lib/env";
import { SIGNATURE_HEADER, signRequest, TIMESTAMP_HEADER } from "./lib/hmac";
import { redriveFailedDeliveries } from "./lib/notifications";
import { firstName, isTrustedLender } from "./lib/users";
import { notificationEventValidator } from "./lib/validators";

const MAX_ERROR_LENGTH = 500;
const FETCH_TIMEOUT_MS = 60_000;

/**
 * Exactly what n8n receives: enough to write one email, nothing more. No Clerk
 * or Convex user ids, no description, notes or loan status, and only the
 * recipient's own email address; the other party appears by first name.
 */
const payloadValidator = v.object({
  appUrl: v.string(),
  counterpartFirstName: v.string(),
  // Lets the email show the same Trusted Lender badge the app shows.
  counterpartIsTrustedLender: v.boolean(),
  event: notificationEventValidator,
  eventId: v.string(),
  loan: v.object({ endDate: v.string(), startDate: v.string() }),
  occurredAt: v.string(),
  recipient: v.object({ email: v.string(), firstName: v.string() }),
  // Absent once the listing is gone; n8n words the email around it.
  toolName: v.optional(v.string()),
});

export type NotificationPayload = typeof payloadValidator.type;

/** Counts the attempt and snapshots the payload in one transaction. */
export const startAttempt = internalMutation({
  args: { appUrl: v.string(), outboxId: v.id("notificationOutbox") },
  handler: async (ctx, { appUrl, outboxId }) => {
    const entry = await ctx.db.get(outboxId);
    const loan = entry && (await ctx.db.get(entry.loanId));
    if (!(entry && loan)) return null;
    await ctx.db.patch(outboxId, { attempts: entry.attempts + 1 });

    const isOwner = entry.recipientId === loan.ownerId;
    const [recipient, counterpart, tool] = await Promise.all([
      ctx.db.get(entry.recipientId),
      ctx.db.get(isOwner ? loan.borrowerId : loan.ownerId),
      ctx.db.get(loan.toolId),
    ]);
    if (!recipient?.email) return null;
    return {
      appUrl: `${appUrl}${isOwner ? "/my/incoming" : "/my/requests"}`,
      counterpartFirstName: counterpart
        ? firstName(counterpart.name)
        : "A neighbor",
      counterpartIsTrustedLender: isTrustedLender(counterpart),
      event: entry.event,
      eventId: outboxId,
      loan: { endDate: loan.endDate, startDate: loan.startDate },
      occurredAt: new Date(entry._creationTime).toISOString(),
      recipient: {
        email: recipient.email,
        firstName: firstName(recipient.name),
      },
      toolName: tool?.name,
    };
  },
  returns: v.union(payloadValidator, v.null()),
});

function isRetryableStatus(status: number) {
  return status >= 500 || status === 408 || status === 429;
}

/** POSTs one signed event to the n8n production webhook. */
export const deliver = internalAction({
  args: { outboxId: v.id("notificationOutbox") },
  handler: async (ctx, { outboxId }) => {
    const url = process.env.N8N_REQUEST_WEBHOOK_URL;
    const secret = process.env.N8N_OUTBOUND_SECRET;
    const appUrl = appUrlFromEnv();
    if (!(url && secret && appUrl)) {
      throw new NonRetryableError(
        "N8N_REQUEST_WEBHOOK_URL, N8N_OUTBOUND_SECRET and APP_URL must be set"
      );
    }
    const payload = await ctx.runMutation(internal.notifications.startAttempt, {
      appUrl,
      outboxId,
    });
    if (!payload) {
      throw new NonRetryableError("Loan or recipient email no longer exists");
    }

    const body = JSON.stringify(payload);
    const { signature, timestamp } = await signRequest(secret, {
      body,
      method: "POST",
      path: new URL(url).pathname,
    });
    const response = await fetch(url, {
      body,
      headers: {
        "content-type": "application/json",
        [SIGNATURE_HEADER]: signature,
        [TIMESTAMP_HEADER]: timestamp,
      },
      method: "POST",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      const message = `n8n responded ${response.status}`;
      throw isRetryableStatus(response.status)
        ? new Error(message)
        : new NonRetryableError(message);
    }
    return null;
  },
  returns: v.null(),
});

export const onDelivered = internalMutation({
  args: vOnCompleteArgs(v.object({ outboxId: v.id("notificationOutbox") })),
  handler: async (ctx, { context, result }) => {
    const { outboxId } = context;
    if (result.kind === "success") {
      await ctx.db.patch(outboxId, { sentAt: Date.now(), status: "sent" });
      return null;
    }
    const error =
      result.kind === "failed" ? result.error : "Delivery was cancelled";
    console.error("Notification delivery failed", { error, outboxId });
    await ctx.db.patch(outboxId, {
      failedAt: Date.now(),
      lastError: error.slice(0, MAX_ERROR_LENGTH),
      status: "failed",
    });
    // A cancellation was deliberate; only real failures page ops.
    if (result.kind === "failed") await noteFailure(ctx, "delivery", error);
    return null;
  },
  returns: v.null(),
});

/**
 * Re-queues failed deliveries once an outage is fixed:
 *   npx convex run notifications:redriveFailed
 * Admins can do the same from /admin/automation (admin.retryFailedNotifications).
 */
export const redriveFailed = internalMutation({
  args: {},
  handler: (ctx) => redriveFailedDeliveries(ctx),
  returns: v.number(),
});
