import type { WorkId } from "@convex-dev/workpool";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { alertEmail } from "./alerts";
import { addDays, todayUtc } from "./lib/dates";
import { identityFor, newTest } from "./test.setup";

const WEBHOOK = "https://n8n.example/webhook/lendloop/request-events";
const RESEND = "https://api.resend.com/emails";
// Midday UTC keeps every retry and alert on one calendar day.
const MIDDAY_UTC = new Date("2026-06-15T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ now: MIDDAY_UTC });
  vi.stubEnv("N8N_REQUEST_WEBHOOK_URL", WEBHOOK);
  vi.stubEnv("N8N_OUTBOUND_SECRET", "outbound-secret");
  vi.stubEnv("APP_URL", "https://lendloop.example");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function configureResend() {
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_FROM", "LendLoop <alerts@lendloop.example>");
  vi.stubEnv("OPS_ALERT_EMAIL", "ops@lendloop.example");
}

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
    category: "garden",
    condition: "good",
    description: "",
    name: "Mower",
  });
  const day = (offset: number) => addDays(todayUtc(), offset);
  const request = (offset: number) =>
    borrower.caller.mutation(api.loans.request, {
      endDate: day(offset),
      startDate: day(offset),
      toolId,
    });
  const overdueLoan = () =>
    t.run((ctx) =>
      ctx.db.insert("loans", {
        borrowerId: borrower.userId,
        endDate: day(-2),
        ownerId: owner.userId,
        startDate: day(-5),
        status: "approved",
        toolId,
      })
    );
  /** One run of the alert cron. */
  const runAlertCron = () => t.action(internal.alerts.sendPendingAlerts, {});
  const pending = () => t.run((ctx) => ctx.db.query("pendingAlerts").collect());
  return { borrower, overdueLoan, pending, request, runAlertCron, t };
}

/** n8n is down (503 on every attempt); Resend answers with `resendStatus`. */
function stubOutage(resendStatus = 200) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) =>
    url === RESEND
      ? Response.json({ id: "email_1" }, { status: resendStatus })
      : new Response("unavailable", { status: 503 })
  );
  vi.stubGlobal("fetch", fetchMock);
  return () => fetchMock.mock.calls.filter(([url]) => url === RESEND);
}

describe("ops alerts", () => {
  test("a burst of failed deliveries is one alert, then cleared", async () => {
    configureResend();
    const alerts = stubOutage();
    const s = await setup();
    await s.request(1);
    await s.request(2);
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await s.pending()).toHaveLength(2);

    await s.runAlertCron();
    expect(alerts()).toHaveLength(1);
    const [, init] = alerts()[0]!;
    const headers = init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test");
    expect(headers["Idempotency-Key"]).toMatch(/^lendloop-ops-alert-/u);
    const body = JSON.parse(init!.body as string);
    expect(body).toMatchObject({
      from: "LendLoop <alerts@lendloop.example>",
      subject: "LendLoop: 2 request notifications failed",
      to: ["ops@lendloop.example"],
    });
    expect(body.text).toContain("n8n responded 503");
    expect(body.text).toContain("https://lendloop.example/admin/automation");
    expect(await s.pending()).toEqual([]);

    // Nothing new: the next run sends nothing.
    await s.runAlertCron();
    expect(alerts()).toHaveLength(1);
  });

  test("a rejected alert keeps its failures for the next run", async () => {
    configureResend();
    const alerts = stubOutage(500);
    const s = await setup();
    await s.request(1);
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);
    await s.runAlertCron();
    expect(alerts()).toHaveLength(1);
    expect(await s.pending()).toHaveLength(1);
  });

  test("a reminder that keeps failing alerts once that day", async () => {
    configureResend();
    const alerts = stubOutage();
    const s = await setup();
    const loanId = await s.overdueLoan();
    const record = (status: "sent" | "failed") =>
      s.t.mutation(internal.reminders.recordReminder, {
        error: status === "failed" ? "Resend 422" : undefined,
        loanId,
        reminderDate: todayUtc(),
        status,
      });
    await record("failed");
    await record("failed"); // the next hourly retry
    await record("sent");
    await s.runAlertCron();

    expect(alerts()).toHaveLength(1);
    expect(JSON.parse(alerts()[0]![1]!.body as string).subject).toBe(
      "LendLoop: 1 overdue reminder failed"
    );
  });

  test("cancelled deliveries don't alert", async () => {
    const s = await setup();
    const loanId = await s.overdueLoan();
    const outboxId = await s.t.run((ctx) =>
      ctx.db.insert("notificationOutbox", {
        attempts: 0,
        event: "request.created",
        loanId,
        recipientId: s.borrower.userId,
        status: "pending",
      })
    );
    await s.t.mutation(internal.notifications.onDelivered, {
      context: { outboxId },
      result: { kind: "canceled" },
      workId: "work_1" as WorkId,
    });
    expect(await s.pending()).toEqual([]);
  });

  test("without Resend settings the alert is logged and dropped", async () => {
    const alerts = stubOutage();
    const s = await setup();
    await s.request(1);
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);
    await s.runAlertCron();
    expect(alerts()).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Ops alert not sent"),
      expect.objectContaining({ deliveryFailures: 1 })
    );
    expect(await s.pending()).toEqual([]);
  });
});

test("alertEmail names both kinds and leaves out empty lines", () => {
  expect(
    alertEmail(
      {
        deliveryFailures: 1,
        ids: [],
        lastError: "n8n responded 502",
        reminderFailures: 3,
      },
      undefined
    )
  ).toEqual({
    subject: "LendLoop: 1 request notification and 3 overdue reminders failed",
    text: "1 request notification and 3 overdue reminders failed since the last alert.\n\nLatest error: n8n responded 502\n\nFailed notifications can be retried from the admin Automation page once n8n is healthy.",
  });
});
