import { type FunctionArgs, httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { type ActionCtx, httpAction } from "./_generated/server";
import { todayUtc } from "./lib/dates";
import { appUrl } from "./lib/env";
import {
  MAX_SKEW_SECONDS,
  SIGNATURE_HEADER,
  signRequest,
  TIMESTAMP_HEADER,
  verifyRequest,
} from "./lib/hmac";

// Endpoints called by n8n Cloud. There is no user identity here: a fresh,
// unused HMAC made with N8N_INBOUND_SECRET is the only authorization.

const OVERDUE_PATH = "/n8n/overdue-loans";
const REMINDERS_PATH = "/n8n/reminders";
const MAX_BODY_BYTES = 10_000;
const encoder = new TextEncoder();

function respond(status: number, body: string, headers: HeadersInit = {}) {
  return new Response(body, {
    headers: { "content-type": "application/json", ...headers },
    status,
  });
}

function json(status: number, data: unknown) {
  return respond(status, JSON.stringify(data));
}

/**
 * Checks the signature, and with `singleUse` that it hasn't been accepted
 * before. Returns the secret on success, or the error response to send.
 */
async function authenticate(
  ctx: ActionCtx,
  request: Request,
  body: string,
  { singleUse }: { singleUse: boolean }
): Promise<{ secret: string } | { error: Response }> {
  const secret = process.env.N8N_INBOUND_SECRET;
  if (!secret) {
    console.error("N8N_INBOUND_SECRET is not set; refusing n8n requests");
    return { error: json(500, { error: "server misconfigured" }) };
  }
  const path = new URL(request.url).pathname;
  const signature = request.headers.get(SIGNATURE_HEADER);
  const result = await verifyRequest(secret, {
    body,
    method: request.method,
    path,
    signature,
    timestamp: request.headers.get(TIMESTAMP_HEADER),
  });
  if (!result.ok) {
    console.warn("Rejected n8n request", { path, reason: result.reason });
    return { error: json(401, { error: "invalid signature" }) };
  }
  if (!singleUse) return { secret };
  const fresh = await ctx.runMutation(internal.reminders.claimSignature, {
    expiresAt: Date.now() + 2 * MAX_SKEW_SECONDS * 1000,
    signature: signature ?? "",
  });
  if (!fresh) {
    console.warn("Rejected replayed n8n request", { path });
    return { error: json(401, { error: "signature already used" }) };
  }
  return { secret };
}

const http = httpRouter();

/**
 * Overdue loans for today's reminder run. The response is signed too (method
 * "RESPONSE") so n8n can trust what it is about to email.
 */
http.route({
  handler: httpAction(async (ctx, request) => {
    // Single use: a replayed request would hand out borrower emails again.
    const auth = await authenticate(ctx, request, "", { singleUse: true });
    if ("error" in auth) return auth.error;
    const url = appUrl();
    if (!url) return json(500, { error: "server misconfigured" });

    const reminderDate = todayUtc();
    const loans = await ctx.runQuery(internal.reminders.listOverdue, {
      today: reminderDate,
    });
    const body = JSON.stringify({
      appUrl: `${url}/my/requests`,
      loans,
      reminderDate,
    });
    const { signature, timestamp } = await signRequest(auth.secret, {
      body,
      method: "RESPONSE",
      path: OVERDUE_PATH,
    });
    return respond(200, body, {
      [SIGNATURE_HEADER]: signature,
      [TIMESTAMP_HEADER]: timestamp,
    });
  }),
  method: "GET",
  path: OVERDUE_PATH,
});

/** Reminder outcome written back by n8n; idempotent per loan and day. */
http.route({
  handler: httpAction(async (ctx, request) => {
    // Refuse oversized bodies before buffering them.
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_BYTES) {
      return json(413, { error: "payload too large" });
    }
    const body = await request.text();
    if (encoder.encode(body).byteLength > MAX_BODY_BYTES) {
      return json(413, { error: "payload too large" });
    }
    // Replays are harmless here (the write-back is idempotent), and n8n's
    // Retry On Fail resends the same signature, so it must stay accepted.
    const auth = await authenticate(ctx, request, body, { singleUse: false });
    if ("error" in auth) return auth.error;

    let outcome: unknown;
    try {
      outcome = JSON.parse(body);
    } catch {
      return json(400, { error: "invalid json" });
    }
    try {
      // The mutation's validators reject unknown fields and wrong types.
      const { result } = await ctx.runMutation(
        internal.reminders.recordReminder,
        outcome as FunctionArgs<typeof internal.reminders.recordReminder>
      );
      if (result === "invalid") {
        return json(400, { error: "invalid reminder" });
      }
      return json(200, { result });
    } catch (error) {
      console.warn("Rejected reminder write-back", { error: String(error) });
      return json(400, { error: "invalid reminder" });
    }
  }),
  method: "POST",
  path: REMINDERS_PATH,
});

export default http;
