import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { addDays, todayUtc } from "./lib/dates";
import { signRequest, verifyRequest } from "./lib/hmac";
import { identityFor, newTest } from "./test.setup";

const SECRET = "inbound-secret";
const today = todayUtc();
const day = (offset: number) => addDays(today, offset);

beforeEach(() => {
  vi.stubEnv("N8N_INBOUND_SECRET", SECRET);
  vi.stubEnv("APP_URL", "https://lendloop.example");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function setup() {
  const t = newTest();
  const as = async (subject: string) => {
    const caller = t.withIdentity(identityFor(subject));
    return await caller.mutation(api.users.syncCurrentUser, {});
  };
  const ownerId = await as("olive");
  const borrowerId = await as("ben");
  const toolId = await t
    .withIdentity(identityFor("olive"))
    .mutation(api.tools.create, {
      category: "power_tools",
      condition: "good",
      description: "",
      name: "Drill",
    });
  const loan = (fields: {
    startDate: string;
    endDate: string;
    status: "approved" | "returned";
  }) =>
    t.run((ctx) =>
      ctx.db.insert("loans", { borrowerId, ownerId, toolId, ...fields })
    );
  return { loan, t };
}

type T = Awaited<ReturnType<typeof setup>>["t"];

async function signedFetch(
  t: T,
  method: "GET" | "POST",
  path: string,
  body = "",
  { secret = SECRET, nowMs = Date.now() } = {}
) {
  const { signature, timestamp } = await signRequest(
    secret,
    { body, method, path },
    nowMs
  );
  return await t.fetch(path, {
    body: method === "POST" ? body : undefined,
    headers: {
      "content-type": "application/json",
      "x-lendloop-signature": signature,
      "x-lendloop-timestamp": timestamp,
    },
    method,
  });
}

function reminderBody(loanId: Id<"loans">, status: "sent" | "failed") {
  return JSON.stringify({
    idempotencyKey: `${loanId}:${today}`,
    loanId,
    reminderDate: today,
    status,
    ...(status === "failed" ? { error: "Resend 503" } : {}),
  });
}

function reminderRows(t: T) {
  return t.run((ctx) => ctx.db.query("reminders").collect());
}

describe("GET /n8n/overdue-loans", () => {
  test("returns only overdue approved loans, minimized and signed", async () => {
    const { loan, t } = await setup();
    const overdue = await loan({
      endDate: day(-2),
      startDate: day(-5),
      status: "approved",
    });
    await loan({ endDate: day(2), startDate: day(-1), status: "approved" });
    await loan({ endDate: day(-2), startDate: day(-5), status: "returned" });

    const response = await signedFetch(t, "GET", "/n8n/overdue-loans");
    expect(response.status).toBe(200);
    const body = await response.text();

    expect(
      await verifyRequest(SECRET, {
        body,
        method: "RESPONSE",
        path: "/n8n/overdue-loans",
        signature: response.headers.get("x-lendloop-signature"),
        timestamp: response.headers.get("x-lendloop-timestamp"),
      })
    ).toEqual({ ok: true });

    const data = JSON.parse(body);
    expect(data.reminderDate).toBe(today);
    expect(data.loans).toEqual([
      {
        appUrl: "https://lendloop.example/my/requests",
        borrower: { email: "ben@example.test", firstName: "ben" },
        daysOverdue: 2,
        dueDate: day(-2),
        idempotencyKey: `${overdue}:${today}`,
        loanId: overdue,
        ownerFirstName: "olive",
        reminderDate: today,
        toolName: "Drill",
      },
    ]);
    expect(body).not.toContain("olive@example.test");
  });

  test("skips loans already reminded today", async () => {
    const { loan, t } = await setup();
    const overdue = await loan({
      endDate: day(-1),
      startDate: day(-3),
      status: "approved",
    });
    await signedFetch(
      t,
      "POST",
      "/n8n/reminders",
      reminderBody(overdue, "sent")
    );
    const response = await signedFetch(t, "GET", "/n8n/overdue-loans");
    expect((await response.json()).loans).toEqual([]);
  });

  test.each([
    ["no signature", async (t: T) => await t.fetch("/n8n/overdue-loans")],
    [
      "the wrong secret",
      async (t: T) =>
        await signedFetch(t, "GET", "/n8n/overdue-loans", "", {
          secret: "nope",
        }),
    ],
    [
      "a stale timestamp",
      async (t: T) =>
        await signedFetch(t, "GET", "/n8n/overdue-loans", "", {
          nowMs: Date.now() - 10 * 60 * 1000,
        }),
    ],
    [
      "a signature for another endpoint",
      async (t: T) => {
        const { signature, timestamp } = await signRequest(SECRET, {
          body: "",
          method: "GET",
          path: "/n8n/reminders",
        });
        return await t.fetch("/n8n/overdue-loans", {
          headers: {
            "x-lendloop-signature": signature,
            "x-lendloop-timestamp": timestamp,
          },
        });
      },
    ],
  ])("rejects %s with 401", async (_label, call) => {
    const { t } = await setup();
    expect((await call(t)).status).toBe(401);
  });

  test("fails closed without a configured secret", async () => {
    vi.stubEnv("N8N_INBOUND_SECRET", "");
    const { t } = await setup();
    expect((await signedFetch(t, "GET", "/n8n/overdue-loans")).status).toBe(
      500
    );
  });
});

describe("POST /n8n/reminders", () => {
  test("is idempotent per loan and day", async () => {
    const { loan, t } = await setup();
    const loanId = await loan({
      endDate: day(-1),
      startDate: day(-3),
      status: "approved",
    });
    const body = reminderBody(loanId, "sent");
    const first = await signedFetch(t, "POST", "/n8n/reminders", body);
    const retry = await signedFetch(t, "POST", "/n8n/reminders", body);
    expect(await first.json()).toEqual({ result: "created" });
    expect(await retry.json()).toEqual({ result: "duplicate" });
    expect(await reminderRows(t)).toHaveLength(1);
  });

  test("a later success upgrades a failed attempt, never the reverse", async () => {
    const { loan, t } = await setup();
    const loanId = await loan({
      endDate: day(-1),
      startDate: day(-3),
      status: "approved",
    });
    await signedFetch(
      t,
      "POST",
      "/n8n/reminders",
      reminderBody(loanId, "failed")
    );
    const upgraded = await signedFetch(
      t,
      "POST",
      "/n8n/reminders",
      reminderBody(loanId, "sent")
    );
    expect(await upgraded.json()).toEqual({ result: "updated" });
    await signedFetch(
      t,
      "POST",
      "/n8n/reminders",
      reminderBody(loanId, "failed")
    );
    const [row] = await reminderRows(t);
    expect(row).toMatchObject({ status: "sent" });
    expect(row?.error).toBeUndefined();
  });

  test("rejects a tampered body", async () => {
    const { loan, t } = await setup();
    const loanId = await loan({
      endDate: day(-1),
      startDate: day(-3),
      status: "approved",
    });
    const body = reminderBody(loanId, "failed");
    const { signature, timestamp } = await signRequest(SECRET, {
      body,
      method: "POST",
      path: "/n8n/reminders",
    });
    const response = await t.fetch("/n8n/reminders", {
      body: body.replace("failed", "sent"),
      headers: {
        "x-lendloop-signature": signature,
        "x-lendloop-timestamp": timestamp,
      },
      method: "POST",
    });
    expect(response.status).toBe(401);
    expect(await reminderRows(t)).toEqual([]);
  });

  test.each([
    ["invalid json", () => "{not json"],
    [
      "an unknown status",
      (id: string) =>
        reminderBody(id as Id<"loans">, "sent").replace('"sent"', '"maybe"'),
    ],
    [
      "a key that doesn't match the loan and date",
      (id: string) =>
        JSON.stringify({
          idempotencyKey: `${id}:2000-01-01`,
          loanId: id,
          reminderDate: today,
          status: "sent",
        }),
    ],
    [
      "an unknown loan id",
      () =>
        JSON.stringify({
          idempotencyKey: `nope:${today}`,
          loanId: "nope",
          reminderDate: today,
          status: "sent",
        }),
    ],
  ])("rejects %s with 400", async (_label, makeBody) => {
    const { loan, t } = await setup();
    const loanId = await loan({
      endDate: day(-1),
      startDate: day(-3),
      status: "approved",
    });
    const response = await signedFetch(
      t,
      "POST",
      "/n8n/reminders",
      makeBody(loanId)
    );
    expect(response.status).toBe(400);
    expect(await reminderRows(t)).toEqual([]);
  });
});
