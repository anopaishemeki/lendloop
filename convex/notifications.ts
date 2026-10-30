import {
  NonRetryableError,
  vOnCompleteArgs,
  Workpool,
} from "@convex-dev/workpool";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { SIGNATURE_HEADER, signRequest, TIMESTAMP_HEADER } from "./lib/hmac";
import { firstName } from "./lib/users";
import {
  loanStatusValidator,
  type NotificationEvent,
  notificationEventValidator,
} from "./lib/validators";

const MAX_ERROR_LENGTH = 500;
const TRAILING_SLASHES = /\/+$/u;

export const notificationPool = new Workpool(components.notificationPool, {
  defaultRetryBehavior: { base: 2, initialBackoffMs: 2000, maxAttempts: 5 },
  maxParallelism: 5,
  // deliver is safe to retry: n8n de-duplicates on eventId.
  retryActionsByDefault: true,
});

/**
 * Exactly what n8n receives: enough to write one email, nothing more. No Clerk
 * or Convex user ids, no description or notes, and only the recipient's own
 * email address; the other party appears by first name.
 */
const payloadValidator = v.object({
  appUrl: v.string(),
  counterpartFirstName: v.string(),
  event: notificationEventValidator,
  eventId: v.string(),
  loan: v.object({
    endDate: v.string(),
    startDate: v.string(),
    status: loanStatusValidator,
  }),
  occurredAt: v.string(),
  recipient: v.object({ email: v.string(), firstName: v.string() }),
  toolName: v.string(),
});

export type NotificationPayload = typeof payloadValidator.type;

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
  await notificationPool.enqueueAction(
    ctx,
    internal.notifications.deliver,
    { outboxId },
    { context: { outboxId }, onComplete: internal.notifications.onDelivered }
  );
}

function linkFor(recipient: Id<"users">, loan: Doc<"loans">) {
  const base = (process.env.APP_URL ?? "").replace(TRAILING_SLASHES, "");
  return `${base}${recipient === loan.ownerId ? "/my/incoming" : "/my/requests"}`;
}

export const buildPayload = internalQuery({
  args: { outboxId: v.id("notificationOutbox") },
  handler: async (ctx, { outboxId }) => {
    const entry = await ctx.db.get(outboxId);
    const loan = entry && (await ctx.db.get(entry.loanId));
    if (!(entry && loan)) return null;
    const counterpartId =
      entry.recipientId === loan.ownerId ? loan.borrowerId : loan.ownerId;
    const [recipient, counterpart, tool] = await Promise.all([
      ctx.db.get(entry.recipientId),
      ctx.db.get(counterpartId),
      ctx.db.get(loan.toolId),
    ]);
    if (!recipient?.email) return null;
    return {
      appUrl: linkFor(entry.recipientId, loan),
      counterpartFirstName: counterpart
        ? firstName(counterpart.name)
        : "A neighbor",
      event: entry.event,
      eventId: outboxId,
      loan: {
        endDate: loan.endDate,
        startDate: loan.startDate,
        status: loan.status,
      },
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

export const recordAttempt = internalMutation({
  args: { outboxId: v.id("notificationOutbox") },
  handler: async (ctx, { outboxId }) => {
    const entry = await ctx.db.get(outboxId);
    if (entry) await ctx.db.patch(outboxId, { attempts: entry.attempts + 1 });
    return null;
  },
  returns: v.null(),
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
    if (!(url && secret)) {
      throw new NonRetryableError(
        "N8N_REQUEST_WEBHOOK_URL and N8N_OUTBOUND_SECRET must be set"
      );
    }
    await ctx.runMutation(internal.notifications.recordAttempt, { outboxId });
    const payload = await ctx.runQuery(internal.notifications.buildPayload, {
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
