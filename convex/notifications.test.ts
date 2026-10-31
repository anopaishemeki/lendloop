import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { addDays, todayUtc } from "./lib/dates";
import { verifyRequest } from "./lib/hmac";
import { REDRIVE_LIMIT } from "./lib/validators";
import { identityFor, newTest } from "./test.setup";

const WEBHOOK =
  "https://lendloop.app.n8n.cloud/webhook/lendloop/request-events";
const SECRET = "outbound-secret";
const day = (offset: number) => addDays(todayUtc(), offset);

async function setup() {
  const t = newTest();
  const as = async (subject: string) => {
    const caller = t.withIdentity(identityFor(subject));
    const userId = await caller.mutation(api.users.syncCurrentUser, {});
    return { caller, userId };
  };
  const owner = await as("olive");
  const borrower = await as("ben");
  const toolId = await owner.caller.mutation(api.tools.create, {
    category: "kitchen",
    condition: "good",
    description: "Private pickup instructions",
    name: "Stand mixer",
  });
  return { borrower, owner, t, toolId };
}

type Setup = Awaited<ReturnType<typeof setup>>;

function outbox(t: Setup["t"]) {
  return t.run((ctx) => ctx.db.query("notificationOutbox").collect());
}

function request(s: Setup) {
  return s.borrower.caller.mutation(api.loans.request, {
    endDate: day(2),
    note: "Birthday cake",
    startDate: day(1),
    toolId: s.toolId,
  });
}

async function drain(t: Setup["t"]) {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

// `day()` reads the clock each time, and draining the workpool fast-forwards
// the fake clock through retry backoffs. Tests read dates before draining;
// starting at midday UTC also keeps every run on one calendar day.
const MIDDAY_UTC = new Date("2026-06-15T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ now: MIDDAY_UTC });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("events", () => {
  test("each lifecycle step notifies the right person", async () => {
    const s = await setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ok"))
    );
    const loanId = await request(s);
    await s.owner.caller.mutation(api.loans.approve, { loanId });
    await s.borrower.caller.mutation(api.loans.cancel, { loanId });

    const rows = await outbox(s.t);
    expect(rows.map(({ event, recipientId }) => [event, recipientId])).toEqual([
      ["request.created", s.owner.userId],
      ["request.approved", s.borrower.userId],
      ["request.cancelled", s.owner.userId],
    ]);
  });

  test("automatic declines still tell the borrower", async () => {
    const s = await setup();
    const loanId = await request(s);
    await s.owner.caller.mutation(api.tools.remove, { toolId: s.toolId });
    const declined = (await outbox(s.t)).filter(
      (row) => row.event === "request.declined"
    );
    expect(declined).toMatchObject([
      { loanId, recipientId: s.borrower.userId },
    ]);
  });
});

describe("delivery", () => {
  test("posts a signed, minimal payload and marks the event sent", async () => {
    vi.stubEnv("N8N_REQUEST_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("N8N_OUTBOUND_SECRET", SECRET);
    vi.stubEnv("APP_URL", "https://lendloop.example/");
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ received: true })
    );
    vi.stubGlobal("fetch", fetchMock);

    const s = await setup();
    await request(s);
    await drain(s.t);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    const headers = init.headers as Record<string, string | undefined>;
    const body = init.body as string;
    expect(url).toBe(WEBHOOK);
    const timestamp = headers["x-lendloop-timestamp"] ?? null;
    // Fake timers advance the clock while the pool drains, so verify at send time.
    expect(
      await verifyRequest(
        SECRET,
        {
          body,
          method: "POST",
          path: "/webhook/lendloop/request-events",
          signature: headers["x-lendloop-signature"] ?? null,
          timestamp,
        },
        Number(timestamp) * 1000
      )
    ).toEqual({ ok: true });

    const payload = JSON.parse(body);
    expect(Object.keys(payload).sort()).toEqual([
      "appUrl",
      "counterpartFirstName",
      "event",
      "eventId",
      "loan",
      "occurredAt",
      "recipient",
      "toolName",
    ]);
    expect(payload).toMatchObject({
      appUrl: "https://lendloop.example/my/incoming",
      counterpartFirstName: "ben",
      event: "request.created",
      recipient: { email: "olive@example.test", firstName: "olive" },
      toolName: "Stand mixer",
    });
    expect(body).not.toContain("Birthday cake");
    expect(body).not.toContain("Private pickup");
    expect(body).not.toContain("ben@example.test");

    const [row] = await outbox(s.t);
    expect(row).toMatchObject({ attempts: 1, status: "sent" });
    expect(row?.sentAt).toBeTypeOf("number");
  });

  test("retries server errors, then records the failure", async () => {
    vi.stubEnv("N8N_REQUEST_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("N8N_OUTBOUND_SECRET", SECRET);
    vi.stubEnv("APP_URL", "https://lendloop.example");
    const fetchMock = vi.fn(async () => new Response("down", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const s = await setup();
    await request(s);
    await drain(s.t);

    expect(fetchMock).toHaveBeenCalledTimes(6);
    const [row] = await outbox(s.t);
    expect(row).toMatchObject({ attempts: 6, status: "failed" });
    expect(row?.lastError).toContain("503");
  });

  test("does not retry a rejected signature", async () => {
    vi.stubEnv("N8N_REQUEST_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("N8N_OUTBOUND_SECRET", SECRET);
    vi.stubEnv("APP_URL", "https://lendloop.example");
    const fetchMock = vi.fn(async () => new Response("no", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const s = await setup();
    await request(s);
    await drain(s.t);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await outbox(s.t))[0]).toMatchObject({ status: "failed" });
  });

  test("fails closed without configuration and never calls out", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const s = await setup();
    await request(s);
    await drain(s.t);

    expect(fetchMock).not.toHaveBeenCalled();
    const [row] = await outbox(s.t);
    expect(row).toMatchObject({ attempts: 0, status: "failed" });
    expect(row?.lastError).toContain("N8N_REQUEST_WEBHOOK_URL");
  });

  test("the loan mutation succeeds even when n8n is down", async () => {
    vi.stubEnv("N8N_REQUEST_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("N8N_OUTBOUND_SECRET", SECRET);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 }))
    );
    const s = await setup();
    const loanId: Id<"loans"> = await request(s);
    await drain(s.t);
    expect((await s.t.run((ctx) => ctx.db.get(loanId)))?.status).toBe(
      "requested"
    );
  });

  test("payload carries no loan status", async () => {
    vi.stubEnv("N8N_REQUEST_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("N8N_OUTBOUND_SECRET", SECRET);
    vi.stubEnv("APP_URL", "https://lendloop.example");
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ received: true })
    );
    vi.stubGlobal("fetch", fetchMock);
    const s = await setup();
    // Read the dates before draining moves the fake clock on.
    const sent = { endDate: day(2), startDate: day(1) };
    await request(s);
    await drain(s.t);
    const payload = JSON.parse(fetchMock.mock.calls[0]?.[1].body as string);
    expect(payload.loan).toEqual(sent);
  });
});

describe("redriveFailed", () => {
  test("drains more than one batch from a single call", async () => {
    vi.stubEnv("N8N_REQUEST_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("N8N_OUTBOUND_SECRET", SECRET);
    vi.stubEnv("APP_URL", "https://lendloop.example");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ received: true }))
    );
    const s = await setup();
    const loanId = await request(s);
    await drain(s.t);
    await s.t.run(async (ctx) => {
      for (let i = 0; i <= REDRIVE_LIMIT; i += 1) {
        await ctx.db.insert("notificationOutbox", {
          attempts: 6,
          event: "request.created",
          loanId,
          recipientId: s.owner.userId,
          status: "failed",
        });
      }
    });

    expect(await s.t.mutation(internal.notifications.redriveFailed, {})).toBe(
      REDRIVE_LIMIT
    );
    await drain(s.t);
    const rows = await outbox(s.t);
    expect(rows.filter((row) => row.status === "failed")).toEqual([]);
  });

  test("re-queues failed events once the outage is fixed", async () => {
    vi.stubEnv("N8N_REQUEST_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("N8N_OUTBOUND_SECRET", SECRET);
    vi.stubEnv("APP_URL", "https://lendloop.example");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 401 }))
    );
    const s = await setup();
    await request(s);
    await drain(s.t);
    expect((await outbox(s.t))[0]?.status).toBe("failed");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ received: true }))
    );
    expect(await s.t.mutation(internal.notifications.redriveFailed, {})).toBe(
      1
    );
    await drain(s.t);
    expect((await outbox(s.t))[0]).toMatchObject({
      attempts: 2,
      status: "sent",
    });
  });
});
