import { describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { toolCounts, userCounts } from "./lib/counters";
import { addDays, todayUtc } from "./lib/dates";
import { identityFor, newTest } from "./test.setup";

const PAGE = { cursor: null, numItems: 25 };

async function setup() {
  const t = newTest();
  const as = async (subject: string, role?: "admin") => {
    const caller = t.withIdentity(identityFor(subject, role));
    const userId = await caller.mutation(api.users.syncCurrentUser, {});
    return { caller, userId };
  };
  const owner = await as("olive");
  const borrower = await as("ben");
  const admin = await as("root", "admin");
  const toolId = await owner.caller.mutation(api.tools.create, {
    category: "camping",
    condition: "good",
    description: "",
    name: "Tent",
  });
  return { admin, borrower, owner, t, toolId };
}

type Setup = Awaited<ReturnType<typeof setup>>;
type Caller = Setup["owner"]["caller"];

describe("admin queries and mutations reject non-admins", () => {
  test.each<[string, (c: Caller) => Promise<unknown>]>([
    [
      "listLoans",
      (c) => c.query(api.admin.listLoans, { paginationOpts: PAGE }),
    ],
    [
      "listTools",
      (c) => c.query(api.admin.listTools, { paginationOpts: PAGE }),
    ],
    [
      "listUsers",
      (c) => c.query(api.admin.listUsers, { paginationOpts: PAGE }),
    ],
    ["overview", (c) => c.query(api.admin.overview, {})],
    ["automationHealth", (c) => c.query(api.admin.automationHealth, {})],
    ["automationOutcomes", (c) => c.query(api.admin.automationOutcomes, {})],
    [
      "listReports",
      (c) => c.query(api.admin.listReports, { paginationOpts: PAGE }),
    ],
    [
      "listNotifications",
      (c) => c.query(api.admin.listNotifications, { paginationOpts: PAGE }),
    ],
    [
      "listReminders",
      (c) => c.query(api.admin.listReminders, { paginationOpts: PAGE }),
    ],
    [
      "retryFailedNotifications",
      (c) => c.mutation(api.admin.retryFailedNotifications, {}),
    ],
  ])("%s", async (_name, call) => {
    const { owner } = await setup();
    await expect(call(owner.caller)).rejects.toThrow(/Admins only/u);
  });

  test("setTrustedLender", async () => {
    const { owner } = await setup();
    await expect(
      owner.caller.mutation(api.admin.setTrustedLender, {
        trusted: true,
        userId: owner.userId,
      })
    ).rejects.toThrow(/Admins only/u);
  });

  test("signed-out callers", async () => {
    const { t } = await setup();
    await expect(
      t.query(api.admin.listLoans, { paginationOpts: PAGE })
    ).rejects.toThrow(/Sign in/u);
  });
});

describe("admin views", () => {
  test("sees every loan with both parties and overdue state", async () => {
    const { admin, borrower, owner, t, toolId } = await setup();
    await t.run((ctx) =>
      ctx.db.insert("loans", {
        borrowerId: borrower.userId,
        endDate: addDays(todayUtc(), -1),
        ownerId: owner.userId,
        startDate: addDays(todayUtc(), -3),
        status: "approved",
        toolId,
      })
    );
    const { page: loans } = await admin.caller.query(api.admin.listLoans, {
      paginationOpts: PAGE,
    });
    expect(loans).toHaveLength(1);
    expect(loans[0]).toMatchObject({
      borrower: { name: "ben" },
      isOverdue: true,
      owner: { name: "olive" },
      toolName: "Tent",
    });
    expect(
      (
        await admin.caller.query(api.admin.listLoans, {
          paginationOpts: PAGE,
          status: "returned",
        })
      ).page
    ).toEqual([]);
  });

  test("lists live tools and can remove any of them", async () => {
    const { admin, toolId } = await setup();
    expect(
      (await admin.caller.query(api.admin.listTools, { paginationOpts: PAGE }))
        .page
    ).toMatchObject([
      { availability: "available", name: "Tent", owner: { name: "olive" } },
    ]);
    await admin.caller.mutation(api.tools.remove, { toolId });
    expect(
      (await admin.caller.query(api.admin.listTools, { paginationOpts: PAGE }))
        .page
    ).toEqual([]);
  });
});

describe("trusted lender", () => {
  test("an admin toggles the badge shown on the owner's tools", async () => {
    const { admin, borrower, owner } = await setup();
    await admin.caller.mutation(api.admin.setTrustedLender, {
      trusted: true,
      userId: owner.userId,
    });
    const [tool] = (
      await borrower.caller.query(api.tools.list, { paginationOpts: PAGE })
    ).page;
    expect(tool?.owner.isTrustedLender).toBe(true);
    const { page: users } = await admin.caller.query(api.admin.listUsers, {
      paginationOpts: PAGE,
    });
    expect(users.find((u) => u._id === owner.userId)?.isTrustedLender).toBe(
      true
    );
  });
});

describe("admin pagination", () => {
  test("lists every user alphabetically across pages", async () => {
    const { admin, t } = await setup();
    for (const name of ["zed", "amy", "kim"]) {
      await t
        .withIdentity(identityFor(name))
        .mutation(api.users.syncCurrentUser, {});
    }
    const first = await admin.caller.query(api.admin.listUsers, {
      paginationOpts: { cursor: null, numItems: 3 },
    });
    const second = await admin.caller.query(api.admin.listUsers, {
      paginationOpts: { cursor: first.continueCursor, numItems: 3 },
    });
    expect([...first.page, ...second.page].map((u) => u.name)).toEqual([
      "amy",
      "ben",
      "kim",
      "olive",
      "root",
      "zed",
    ]);
  });

  test("lists loans newest first regardless of dates", async () => {
    const { admin, borrower, owner, t, toolId } = await setup();
    const insert = (startDate: string, endDate: string) =>
      t.run((ctx) =>
        ctx.db.insert("loans", {
          borrowerId: borrower.userId,
          endDate,
          ownerId: owner.userId,
          startDate,
          status: "requested",
          toolId,
        })
      );
    const older = await insert(
      addDays(todayUtc(), 20),
      addDays(todayUtc(), 21)
    );
    const newer = await insert(addDays(todayUtc(), 1), addDays(todayUtc(), 2));
    const { page } = await admin.caller.query(api.admin.listLoans, {
      paginationOpts: PAGE,
      status: "requested",
    });
    expect(page.map((loan) => loan._id)).toEqual([newer, older]);
  });
});

/** A request for days +1..+2, approved, then moved into the past. */
async function overdueLoan({ borrower, owner, t, toolId }: Setup) {
  const loanId = await borrower.caller.mutation(api.loans.request, {
    endDate: addDays(todayUtc(), 2),
    startDate: addDays(todayUtc(), 1),
    toolId,
  });
  await owner.caller.mutation(api.loans.approve, { loanId });
  await t.run((ctx) =>
    ctx.db.patch(loanId, {
      endDate: addDays(todayUtc(), -1),
      startDate: addDays(todayUtc(), -3),
    })
  );
  return loanId;
}

describe("admin portal", () => {
  test("the overview counts neighbors, listings, loans and overdue loans", async () => {
    const s = await setup();
    await overdueLoan(s);
    await s.admin.caller.mutation(api.admin.setTrustedLender, {
      trusted: true,
      userId: s.owner.userId,
    });

    const [loan] = (
      await s.admin.caller.query(api.admin.listLoans, { paginationOpts: PAGE })
    ).page;
    expect(loan).toMatchObject({
      borrower: { isTrustedLender: false },
      owner: { isTrustedLender: true },
    });
    const [tool] = (
      await s.admin.caller.query(api.admin.listTools, { paginationOpts: PAGE })
    ).page;
    expect(tool?.owner.isTrustedLender).toBe(true);
    expect(tool?.condition).toBe("good");

    expect(await s.admin.caller.query(api.admin.overview, {})).toMatchObject({
      listings: 1,
      loans: { approved: 1, requested: 0 },
      neighbors: 3,
      overdue: 1,
      trustedLenders: 1,
    });
    // The request and the approval are both waiting for the workpool.
    expect(
      await s.admin.caller.query(api.admin.automationHealth, {})
    ).toMatchObject({
      failed: 0,
      queued: 2,
      remindersFailedThisWeek: 0,
      remindersSentThisWeek: 0,
    });
  });

  test("filters loans down to the overdue ones", async () => {
    const s = await setup();
    const overdueId = await overdueLoan(s);
    await s.borrower.caller.mutation(api.loans.request, {
      endDate: addDays(todayUtc(), 6),
      startDate: addDays(todayUtc(), 5),
      toolId: s.toolId,
    });

    const overdue = await s.admin.caller.query(api.admin.listLoans, {
      paginationOpts: PAGE,
      status: "overdue",
    });
    expect(overdue.page.map((loan) => [loan._id, loan.isOverdue])).toEqual([
      [overdueId, true],
    ]);
  });

  test("lists failed deliveries and re-queues them, keeping the attempt count", async () => {
    const { admin, borrower, t, toolId } = await setup();
    await borrower.caller.mutation(api.loans.request, {
      endDate: addDays(todayUtc(), 2),
      startDate: addDays(todayUtc(), 1),
      toolId,
    });
    await t.run(async (ctx) => {
      const [entry] = await ctx.db.query("notificationOutbox").collect();
      if (entry) {
        await ctx.db.patch(entry._id, {
          attempts: 6,
          lastError: "HTTP 500",
          status: "failed",
        });
      }
    });

    const failed = await admin.caller.query(api.admin.listNotifications, {
      paginationOpts: PAGE,
      status: "failed",
    });
    expect(failed.page).toMatchObject([
      {
        attempts: 6,
        event: "request.created",
        lastError: "HTTP 500",
        recipient: { name: "olive" },
        toolName: "Tent",
      },
    ]);
    expect(
      await admin.caller.query(api.admin.automationHealth, {})
    ).toMatchObject({ failed: 1 });

    expect(
      await admin.caller.mutation(api.admin.retryFailedNotifications, {})
    ).toBe(1);
    const [entry] = await t.run((ctx) =>
      ctx.db.query("notificationOutbox").collect()
    );
    expect(entry).toMatchObject({ attempts: 6, status: "pending" });
    expect(entry?.lastError).toBeUndefined();
  });

  test("backfillAllCounters restores counts from the tables", async () => {
    vi.useFakeTimers();
    const s = await setup();
    // As if the counters were added after these rows were written.
    await s.t.run((ctx) => userCounts.clear(ctx));
    await s.t.run((ctx) => toolCounts.clear(ctx));
    expect(await s.admin.caller.query(api.admin.overview, {})).toMatchObject({
      listings: 0,
      neighbors: 0,
    });

    // The backfill counts rows created before it starts.
    vi.advanceTimersByTime(1000);
    await s.t.mutation(internal.migrations.backfillAllCounters, {});
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await s.admin.caller.query(api.admin.overview, {})).toMatchObject({
      listings: 1,
      neighbors: 3,
    });
    vi.useRealTimers();
  });

  test("lists reminders with the tool and borrower", async () => {
    const s = await setup();
    const loanId = await overdueLoan(s);
    const today = todayUtc();
    await s.t.run((ctx) =>
      ctx.db.insert("reminders", {
        idempotencyKey: `${loanId}:${today}`,
        loanId,
        reminderDate: today,
        status: "sent",
        updatedAt: Date.now(),
      })
    );

    const reminders = await s.admin.caller.query(api.admin.listReminders, {
      paginationOpts: PAGE,
    });
    expect(reminders.page).toMatchObject([
      {
        borrower: { name: "ben" },
        reminderDate: today,
        status: "sent",
        toolName: "Tent",
      },
    ]);
  });
});

describe("automationOutcomes", () => {
  test("counts sent and failed deliveries and reminders per day", async () => {
    const s = await setup();
    const today = todayUtc();
    const yesterday = addDays(today, -1);
    const noon = (day: string) => Date.parse(`${day}T12:00:00Z`);
    await s.t.run(async (ctx) => {
      const loanId = await ctx.db.insert("loans", {
        borrowerId: s.borrower.userId,
        endDate: addDays(today, -3),
        ownerId: s.owner.userId,
        startDate: addDays(today, -5),
        status: "approved",
        toolId: s.toolId,
      });
      const delivery = {
        attempts: 1,
        event: "request.created" as const,
        loanId,
        recipientId: s.owner.userId,
      };
      await ctx.db.insert("notificationOutbox", {
        ...delivery,
        sentAt: noon(yesterday),
        status: "sent",
      });
      await ctx.db.insert("notificationOutbox", {
        ...delivery,
        sentAt: noon(today),
        status: "sent",
      });
      await ctx.db.insert("notificationOutbox", {
        ...delivery,
        status: "failed",
      });
      // Gave up yesterday (though written today): filed by failedAt.
      await ctx.db.insert("notificationOutbox", {
        ...delivery,
        failedAt: noon(yesterday),
        status: "failed",
      });
      for (const [reminderDate, status] of [
        [yesterday, "sent"],
        [today, "failed"],
      ] as const) {
        await ctx.db.insert("reminders", {
          idempotencyKey: `${loanId}:${reminderDate}`,
          loanId,
          reminderDate,
          status,
          updatedAt: Date.now(),
        });
      }
    });

    const { deliveries, reminders } = await s.admin.caller.query(
      api.admin.automationOutcomes,
      {}
    );
    expect(deliveries).toHaveLength(14);
    // The failed delivery has no failedAt, so it falls back to when it was queued: today.
    expect(deliveries.slice(-2)).toEqual([
      { day: yesterday, failed: 1, sent: 1 },
      { day: today, failed: 1, sent: 1 },
    ]);
    expect(reminders.slice(-2)).toEqual([
      { day: yesterday, failed: 0, sent: 1 },
      { day: today, failed: 1, sent: 0 },
    ]);
    const quiet = [...deliveries.slice(0, -2), ...reminders.slice(0, -2)];
    expect(quiet.every((d) => d.sent + d.failed === 0)).toBe(true);
    // The overview counts this week's reminders by outcome, so failures show.
    expect(
      await s.admin.caller.query(api.admin.automationHealth, {})
    ).toMatchObject({ remindersFailedThisWeek: 1, remindersSentThisWeek: 1 });
  });
});

describe("listTools filters", () => {
  test("narrows live listings by name, category and condition", async () => {
    const s = await setup();
    const add = (
      name: string,
      category: "garden" | "kitchen",
      condition: "new" | "worn"
    ) =>
      s.owner.caller.mutation(api.tools.create, {
        category,
        condition,
        description: "",
        name,
      });
    await add("Garden spade", "garden", "worn");
    const goneId = await add("Garden rake", "garden", "worn");
    await add("Garden hose", "garden", "new");
    await add("Bread maker", "kitchen", "new");
    await s.owner.caller.mutation(api.tools.remove, { toolId: goneId });

    const names = async (filters: {
      category?: "garden" | "kitchen";
      condition?: "new" | "worn";
      search?: string;
    }) =>
      (
        await s.admin.caller.query(api.admin.listTools, {
          ...filters,
          paginationOpts: PAGE,
        })
      ).page
        .map((tool) => tool.name)
        .sort();
    // setup() also lists a camping tent in good condition.
    expect(await names({})).toEqual([
      "Bread maker",
      "Garden hose",
      "Garden spade",
      "Tent",
    ]);
    expect(await names({ condition: "worn" })).toEqual(["Garden spade"]);
    expect(await names({ category: "kitchen" })).toEqual(["Bread maker"]);
    expect(await names({ category: "garden", condition: "new" })).toEqual([
      "Garden hose",
    ]);
    expect(await names({ search: "garden" })).toEqual([
      "Garden hose",
      "Garden spade",
    ]);
    expect(await names({ condition: "new", search: "garden" })).toEqual([
      "Garden hose",
    ]);
    expect(await names({ search: "   " })).toHaveLength(4);
  });
});
