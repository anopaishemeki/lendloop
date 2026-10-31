import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { addDays, todayUtc } from "./lib/dates";
import { signRequest, verifyRequest } from "./lib/hmac";
import { OVERDUE_BATCH } from "./reminders";
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
  type LoanFields = {
    borrowerId?: Id<"users">;
    startDate: string;
    endDate: string;
    status: "approved" | "returned";
  };
  const insertLoan = (ctx: MutationCtx, fields: LoanFields) =>
    ctx.db.insert("loans", { borrowerId, ownerId, toolId, ...fields });
  const loan = (fields: LoanFields) => t.run((ctx) => insertLoan(ctx, fields));
  const loans = (all: LoanFields[]) =>
    t.run((ctx) => Promise.all(all.map((fields) => insertLoan(ctx, fields))));
  const overdueLoan = (endDate = day(-2)) =>
    loan({ endDate, startDate: day(-5), status: "approved" });
  /** A full batch of overdue loans, due before any other test loan. */
  const oldestBatch = (borrower = borrowerId) =>
    loans(
      Array.from({ length: OVERDUE_BATCH }, () => ({
        borrowerId: borrower,
        endDate: day(-3),
        startDate: day(-5),
        status: "approved" as const,
      }))
    );
  return { loan, oldestBatch, overdueLoan, t };
}

type T = Awaited<ReturnType<typeof setup>>["t"];

async function sign(
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
  return {
    "content-type": "application/json",
    "x-lendloop-signature": signature,
    "x-lendloop-timestamp": timestamp,
  };
}

async function signedFetch(
  t: T,
  method: "GET" | "POST",
  path: string,
  body = "",
  options: { secret?: string; nowMs?: number } = {}
) {
  return await t.fetch(path, {
    body: method === "POST" ? body : undefined,
    headers: await sign(method, path, body, options),
    method,
  });
}

function outcome(
  loanId: Id<"loans">,
  status: "sent" | "failed",
  error?: string
) {
  return JSON.stringify({
    loanId,
    reminderDate: today,
    status,
    ...(error ? { error } : {}),
  });
}

function writeBack(t: T, body: string) {
  return signedFetch(t, "POST", "/n8n/reminders", body);
}

function reminderRows(t: T) {
  return t.run((ctx) => ctx.db.query("reminders").collect());
}

/** One reminder run's loan ids; each run signs afresh, as n8n's runs do. */
async function overdueRun(t: T, nowMs = Date.now()): Promise<string[]> {
  const response = await signedFetch(t, "GET", "/n8n/overdue-loans", "", {
    nowMs,
  });
  const { loans } = await response.json();
  return loans.map((l: { loanId: string }) => l.loanId);
}

describe("GET /n8n/overdue-loans", () => {
  test("returns only overdue approved loans, minimized and signed", async () => {
    const { loan, overdueLoan, t } = await setup();
    const overdue = await overdueLoan();
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

    expect(JSON.parse(body)).toEqual({
      appUrl: "https://lendloop.example/my/requests",
      loans: [
        {
          borrower: { email: "ben@example.test", firstName: "ben" },
          daysOverdue: 2,
          dueDate: day(-2),
          idempotencyKey: `${overdue}:${today}`,
          loanId: overdue,
          ownerFirstName: "olive",
          ownerIsTrustedLender: false,
          toolName: "Drill",
        },
      ],
      reminderDate: today,
    });
    expect(body).not.toContain("olive@example.test");
  });

  test("skips loans already reminded today but retries failed ones", async () => {
    const { overdueLoan, t } = await setup();
    const reminded = await overdueLoan();
    const failed = await overdueLoan();
    await writeBack(t, outcome(reminded, "sent"));
    await writeBack(t, outcome(failed, "failed", "Resend 503"));

    expect(await overdueRun(t)).toEqual([failed]);
  });

  describe("a backlog larger than one run", () => {
    // The write-back mutation directly: signing 200 POSTs adds nothing here.
    function markReminded(
      t: T,
      loanIds: Id<"loans">[],
      status: "sent" | "failed"
    ) {
      return Promise.all(
        loanIds.map((loanId) =>
          t.mutation(internal.reminders.recordReminder, {
            loanId,
            reminderDate: today,
            status,
          })
        )
      );
    }

    test("is worked through oldest first by later runs", async () => {
      const { oldestBatch, overdueLoan, t } = await setup();
      const oldest = await oldestBatch();
      const newer = await overdueLoan(day(-1));

      const first = await overdueRun(t);
      expect(first).toHaveLength(OVERDUE_BATCH);
      expect(new Set(first)).toEqual(new Set(oldest));

      await markReminded(t, oldest, "sent");
      expect(await overdueRun(t, Date.now() + 1000)).toEqual([newer]);
    });

    test("puts loans not yet tried today before failed sends", async () => {
      const { oldestBatch, overdueLoan, t } = await setup();
      const oldest = await oldestBatch();
      const newer = await overdueLoan(day(-1));
      await markReminded(t, oldest, "failed");

      const retry = await overdueRun(t);
      expect(retry).toHaveLength(OVERDUE_BATCH);
      expect(retry[0]).toBe(newer);
      expect(new Set(retry.slice(1))).toEqual(
        new Set(oldest.slice(0, OVERDUE_BATCH - 1))
      );
    });

    test("skips borrowers without an email before filling the batch", async () => {
      const { oldestBatch, overdueLoan, t } = await setup();
      const noEmail = await t.run((ctx) =>
        ctx.db.insert("users", {
          clerkId: "no-email",
          email: "",
          isTrustedLender: false,
          name: "No Email",
        })
      );
      await oldestBatch(noEmail);
      const newer = await overdueLoan(day(-1));

      expect(await overdueRun(t)).toEqual([newer]);
    });
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
      async (t: T) =>
        await t.fetch("/n8n/overdue-loans", {
          headers: await sign("GET", "/n8n/reminders"),
        }),
    ],
  ])("rejects %s with 401", async (_label, call) => {
    const { t } = await setup();
    expect((await call(t)).status).toBe(401);
  });

  test("rejects a replay of an accepted request", async () => {
    const { t } = await setup();
    const headers = await sign("GET", "/n8n/overdue-loans");
    expect((await t.fetch("/n8n/overdue-loans", { headers })).status).toBe(200);
    expect((await t.fetch("/n8n/overdue-loans", { headers })).status).toBe(401);
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
    const { overdueLoan, t } = await setup();
    const body = outcome(await overdueLoan(), "sent");
    expect(await (await writeBack(t, body)).json()).toEqual({
      result: "created",
    });
    expect(await (await writeBack(t, body)).json()).toEqual({
      result: "duplicate",
    });
    const rows = await reminderRows(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.idempotencyKey).toBe(`${rows[0]?.loanId}:${today}`);
  });

  test("a later failure refreshes the error; success is final", async () => {
    const { overdueLoan, t } = await setup();
    const loanId = await overdueLoan();
    await writeBack(t, outcome(loanId, "failed", "first error"));
    await writeBack(t, outcome(loanId, "failed", "second error"));
    expect((await reminderRows(t))[0]).toMatchObject({
      error: "second error",
      status: "failed",
    });

    await writeBack(t, outcome(loanId, "sent"));
    await writeBack(t, outcome(loanId, "failed", "late error"));
    const [row] = await reminderRows(t);
    expect(row).toMatchObject({ status: "sent" });
    expect(row?.error).toBeUndefined();
  });

  test("rejects a tampered body", async () => {
    const { overdueLoan, t } = await setup();
    const body = outcome(await overdueLoan(), "failed", "x");
    const response = await t.fetch("/n8n/reminders", {
      body: body.replace("failed", "sent"),
      headers: await sign("POST", "/n8n/reminders", body),
      method: "POST",
    });
    expect(response.status).toBe(401);
    expect(await reminderRows(t)).toEqual([]);
  });

  test("rejects oversized bodies before verifying them", async () => {
    const { t } = await setup();
    const body = JSON.stringify({ padding: "é".repeat(6000) });
    const response = await writeBack(t, body);
    expect(response.status).toBe(413);
  });

  test.each([
    ["invalid json", () => "{not json"],
    [
      "an unknown status",
      (id: Id<"loans">) => outcome(id, "sent").replace('"sent"', '"maybe"'),
    ],
    [
      "an unexpected field",
      (id: Id<"loans">) =>
        JSON.stringify({
          extra: 1,
          loanId: id,
          reminderDate: today,
          status: "sent",
        }),
    ],
    [
      "an invalid date",
      (id: Id<"loans">) =>
        JSON.stringify({
          loanId: id,
          reminderDate: "2026-02-30",
          status: "sent",
        }),
    ],
    [
      "an unknown loan id",
      () =>
        JSON.stringify({ loanId: "nope", reminderDate: today, status: "sent" }),
    ],
  ])("rejects %s with 400", async (_label, makeBody) => {
    const { overdueLoan, t } = await setup();
    const response = await writeBack(t, makeBody(await overdueLoan()));
    expect(response.status).toBe(400);
    expect(await reminderRows(t)).toEqual([]);
  });
});

describe("purgeUsedSignatures", () => {
  test("removes only expired entries", async () => {
    const { t } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("usedSignatures", {
        expiresAt: Date.now() - 1,
        signature: "old",
      });
      await ctx.db.insert("usedSignatures", {
        expiresAt: Date.now() + 60_000,
        signature: "new",
      });
    });
    expect(await t.mutation(internal.reminders.purgeUsedSignatures, {})).toBe(
      1
    );
    const left = await t.run((ctx) => ctx.db.query("usedSignatures").collect());
    expect(left.map((row) => row.signature)).toEqual(["new"]);
  });
});
