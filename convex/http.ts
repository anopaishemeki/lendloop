import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { todayUtc } from "./lib/dates";
import {
  SIGNATURE_HEADER,
  signRequest,
  TIMESTAMP_HEADER,
  verifyRequest,
} from "./lib/hmac";

// Endpoints called by n8n Cloud. Every request must carry a fresh HMAC made
// with N8N_INBOUND_SECRET; there is no user identity here, so the signature is
// the only authorization.

const OVERDUE_PATH = "/n8n/overdue-loans";
const REMINDERS_PATH = "/n8n/reminders";
const MAX_BODY_BYTES = 10_000;
const TRAILING_SLASHES = /\/+$/u;

function json(status: number, data: unknown, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json", ...headers },
    status,
  });
}

/** Verifies the request signature; returns an error response, or null if valid. */
async function rejectUnsigned(
  request: Request,
  secret: string | undefined,
  body: string
): Promise<Response | null> {
  if (!secret) {
    console.error("N8N_INBOUND_SECRET is not set; refusing n8n requests");
    return json(500, { error: "server misconfigured" });
  }
  const result = await verifyRequest(secret, {
    body,
    method: request.method,
    path: new URL(request.url).pathname,
    signature: request.headers.get(SIGNATURE_HEADER),
    timestamp: request.headers.get(TIMESTAMP_HEADER),
  });
  if (!result.ok) {
    console.warn("Rejected n8n request", {
      path: new URL(request.url).pathname,
      reason: result.reason,
    });
    return json(401, { error: "invalid signature" });
  }
  return null;
}

const http = httpRouter();

/**
 * Overdue loans for today's reminder run. The response is signed too (method
 * "RESPONSE") so n8n can trust what it is about to email.
 */
http.route({
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.N8N_INBOUND_SECRET;
    const rejected = await rejectUnsigned(request, secret, "");
    if (rejected) return rejected;

    const appUrl = process.env.APP_URL?.replace(TRAILING_SLASHES, "");
    if (!(secret && appUrl))
      return json(500, { error: "server misconfigured" });

    const today = todayUtc();
    const loans = await ctx.runQuery(internal.reminders.listOverdue, {
      appUrl,
      today,
    });
    const body = JSON.stringify({ loans, reminderDate: today });
    const { signature, timestamp } = await signRequest(secret, {
      body,
      method: "RESPONSE",
      path: OVERDUE_PATH,
    });
    return new Response(body, {
      headers: {
        "content-type": "application/json",
        [SIGNATURE_HEADER]: signature,
        [TIMESTAMP_HEADER]: timestamp,
      },
      status: 200,
    });
  }),
  method: "GET",
  path: OVERDUE_PATH,
});

/** Reminder outcome written back by n8n; idempotent per loan and day. */
http.route({
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) {
      return json(413, { error: "payload too large" });
    }
    const rejected = await rejectUnsigned(
      request,
      process.env.N8N_INBOUND_SECRET,
      body
    );
    if (rejected) return rejected;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body);
    } catch {
      return json(400, { error: "invalid json" });
    }
    const { loanId, reminderDate, idempotencyKey, status, error } = parsed;
    if (
      typeof loanId !== "string" ||
      typeof reminderDate !== "string" ||
      typeof idempotencyKey !== "string" ||
      (status !== "sent" && status !== "failed") ||
      (error !== undefined && typeof error !== "string")
    ) {
      return json(400, { error: "invalid reminder" });
    }

    const { result } = await ctx.runMutation(
      internal.reminders.recordReminder,
      {
        error,
        idempotencyKey,
        loanId,
        reminderDate,
        status,
      }
    );
    if (result === "invalid") return json(400, { error: "invalid reminder" });
    return json(200, { result });
  }),
  method: "POST",
  path: REMINDERS_PATH,
});

export default http;
