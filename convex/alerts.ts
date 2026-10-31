import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalQuery } from "./_generated/server";
import { internalMutation } from "./functions";
import { appUrl } from "./lib/env";

const RESEND_URL = "https://api.resend.com/emails";
const FETCH_TIMEOUT_MS = 15_000;
/** Failures summarized per alert; any beyond go in the next one. */
const BATCH = 500;

const batchValidator = v.object({
  deliveryFailures: v.number(),
  ids: v.array(v.id("pendingAlerts")),
  lastError: v.string(),
  reminderFailures: v.number(),
});
type Batch = typeof batchValidator.type;

/** The failures not yet alerted, oldest first, summarized. */
export const pendingBatch = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("pendingAlerts").take(BATCH);
    const last = rows.at(-1);
    if (!last) return null;
    const count = (kind: string) => rows.filter((r) => r.kind === kind).length;
    return {
      deliveryFailures: count("delivery"),
      ids: rows.map((r) => r._id),
      lastError: last.error,
      reminderFailures: count("reminder"),
    };
  },
  returns: v.union(batchValidator, v.null()),
});

/** Clears failures once their alert went out. */
export const clearBatch = internalMutation({
  args: { ids: v.array(v.id("pendingAlerts")) },
  handler: async (ctx, { ids }) => {
    await Promise.all(ids.map((id) => ctx.db.delete(id)));
    return null;
  },
  returns: v.null(),
});

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** The alert's subject and plain-text body; no names or email addresses. */
export function alertEmail(batch: Batch, automationUrl: string | undefined) {
  const what = [
    batch.deliveryFailures > 0
      ? plural(batch.deliveryFailures, "request notification")
      : null,
    batch.reminderFailures > 0
      ? plural(batch.reminderFailures, "overdue reminder")
      : null,
  ]
    .filter((part) => part !== null)
    .join(" and ");
  return {
    subject: `LendLoop: ${what} failed`,
    text: [
      `${what} failed since the last alert.`,
      `Latest error: ${batch.lastError}`,
      batch.deliveryFailures > 0
        ? "Failed notifications can be retried from the admin Automation page once n8n is healthy."
        : null,
      automationUrl ? `Automation: ${automationUrl}` : null,
    ]
      .filter((line) => line !== null)
      .join("\n\n"),
  };
}

/**
 * Emails ops one summary of the failures queued since the last alert (run by
 * a cron every few minutes). It goes through Resend directly, not n8n: failed
 * deliveries usually mean n8n is down. The failures are cleared only once
 * Resend accepts the email, so a failed send is retried on the next run.
 * Without RESEND_API_KEY, RESEND_FROM and OPS_ALERT_EMAIL it only logs.
 */
export const sendPendingAlerts = internalAction({
  args: {},
  handler: async (ctx) => {
    const batch = await ctx.runQuery(internal.alerts.pendingBatch, {});
    if (!batch) return null;
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    const to = process.env.OPS_ALERT_EMAIL;
    if (!(apiKey && from && to)) {
      console.error(
        "Ops alert not sent: set RESEND_API_KEY, RESEND_FROM and OPS_ALERT_EMAIL",
        { ...batch, ids: undefined }
      );
      await ctx.runMutation(internal.alerts.clearBatch, { ids: batch.ids });
      return null;
    }
    const base = appUrl();
    const { subject, text } = alertEmail(
      batch,
      base ? `${base}/admin/automation` : undefined
    );
    const response = await fetch(RESEND_URL, {
      body: JSON.stringify({ from, subject, text, to: [to] }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Same batch, same key: a retry after a lost response sends nothing twice.
        "Idempotency-Key": `lendloop-ops-alert-${batch.ids[0]}`,
      },
      method: "POST",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error("Ops alert failed; retrying next run", {
        status: response.status,
      });
      return null;
    }
    await ctx.runMutation(internal.alerts.clearBatch, { ids: batch.ids });
    return null;
  },
  returns: v.null(),
});
