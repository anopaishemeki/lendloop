import { NonRetryableError, vOnCompleteArgs } from "@convex-dev/workpool";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import { SIGNATURE_HEADER, signRequest, TIMESTAMP_HEADER } from "./lib/hmac";
import { scheduleDelivery } from "./lib/notifications";
import { firstName } from "./lib/users";
import { notificationEventValidator } from "./lib/validators";

const MAX_ERROR_LENGTH = 500;
const REDRIVE_LIMIT = 100;
const FETCH_TIMEOUT_MS = 60_000;
const TRAILING_SLASHES = /\/+$/u;

/**
 * Exactly what n8n receives: enough to write one email, nothing more. No Clerk
 * or Convex user ids, no description, notes or loan status, and only the
 * recipient's own email address; the other party appears by first name.
 */
const payloadValidator = v.object({
  appUrl: v.string(),
  counterpartFirstName: v.string(),
  event: notificationEventValidator,
  eventId: v.string(),
  loan: v.object({ endDate: v.string(), startDate: v.string() }),
  occurredAt: v.string(),
  recipient: v.object({ email: v.string(), firstName: v.string() }),
  toolName: v.string(),
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
      event: entry.event,
      eventId: outboxId,
      loan: { endDate: loan.endDate, startDate: loan.startDate },
      occurredAt: new Date(entry._creationTime).toISOString(),
      recipient: {
        email: recipient.email,
        firstName: firstName(recipient.name),
      },
      toolName: tool?.name ?? "a tool",
    };
  },
  returns: v.union(payloadValidator, v.null()),
});

function isRetryableStatus(status: number) {
  return status >= 500 || status === 408 || status === 429;
}

/** POSTs one signed event to the n8n Cloud production webhook. */
export const deliver = internalAction({
  args: { outboxId: v.id("notificationOutbox") },
  handler: async (ctx, { outboxId }) => {
    const url = process.env.N8N_REQUEST_WEBHOOK_URL;
    const secret = process.env.N8N_OUTBOUND_SECRET;
    const appUrl = process.env.APP_URL?.replace(TRAILING_SLASHES, "");
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
      lastError: error.slice(0, MAX_ERROR_LENGTH),
      status: "failed",
    });
    return null;
  },
  returns: v.null(),
});

/**
 * Re-queues failed deliveries once an outage is fixed:
 *   npx convex run notifications:redriveFailed
 */
export const redriveFailed = internalMutation({
  args: {},
  handler: async (ctx) => {
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
    return failed.length;
  },
  returns: v.number(),
});
