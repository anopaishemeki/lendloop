import type { WorkId } from "@convex-dev/workpool";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { TableNames } from "./_generated/dataModel";
import { identityFor, newTest } from "./test.setup";

async function setup() {
  const t = newTest();
  const admin = t.withIdentity(identityFor("root", "admin"));
  await admin.mutation(api.users.syncCurrentUser, {});
  return { admin, t };
}

const count = (t: ReturnType<typeof newTest>, table: TableNames) =>
  t.run(async (ctx) => (await ctx.db.query(table).collect()).length);

describe("seed:demo", () => {
  test("fills the board, the overview and the outcomes chart, once", async () => {
    const { admin, t } = await setup();
    expect(await t.mutation(internal.seed.demo, {})).toMatch(/^Seeded 8/u);
    expect(await t.mutation(internal.seed.demo, {})).toMatch(/already/u);

    expect(await admin.query(api.admin.overview, {})).toMatchObject({
      listings: 16,
      loans: {
        approved: 4,
        cancelled: 1,
        declined: 1,
        requested: 3,
        returned: 4,
      },
      neighbors: 9,
      openReports: 1,
      overdue: 2,
      trustedLenders: 3,
    });
    const { deliveries, reminders } = await admin.query(
      api.admin.automationOutcomes,
      {}
    );
    const total = (series: typeof deliveries, key: "sent" | "failed") =>
      series.reduce((sum, day) => sum + day[key], 0);
    expect(total(deliveries, "sent")).toBeGreaterThan(15);
    expect(total(reminders, "sent")).toBe(5);
    expect(total(reminders, "failed")).toBe(1);

    // Seeding sends nothing: every email row is already sent, nothing queued.
    const health = await admin.query(api.admin.automationHealth, {});
    expect(health).toMatchObject({ failed: 0, queued: 0 });
  });

  test("every seeded loan's emails are in order, request first", async () => {
    const { t } = await setup();
    await t.mutation(internal.seed.demo, {});
    const histories = await t.run(async (ctx) => {
      const loans = await ctx.db.query("loans").collect();
      return Promise.all(
        loans.map(async (loan) =>
          (
            await ctx.db
              .query("notificationOutbox")
              .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
              .collect()
          )
            .sort((a, b) => (a.sentAt ?? 0) - (b.sentAt ?? 0))
            .map((row) => row.event)
        )
      );
    });
    expect(histories).toHaveLength(13);
    for (const events of histories) {
      expect(events[0]).toBe("request.created");
      expect(new Set(events).size).toBe(events.length);
    }
  });

  test("removeDemo takes it all out again", async () => {
    const { t } = await setup();
    await t.mutation(internal.seed.demo, {});
    await t.mutation(internal.seed.removeDemo, {});
    for (const table of [
      "tools",
      "loans",
      "notificationOutbox",
      "reminders",
      "reports",
    ] as const) {
      expect(await count(t, table)).toBe(0);
    }
    expect(await count(t, "users")).toBe(1); // the real admin stays
  });
});

describe("seed:removeE2E", () => {
  test("clears only the end-to-end users and what they made", async () => {
    const { t } = await setup();
    await t.mutation(internal.seed.demo, {});
    const lender = t.withIdentity({
      ...identityFor("e2e-lender"),
      email: "delivered+lendloop-e2e-lender@resend.dev",
    });
    await lender.mutation(api.users.syncCurrentUser, {});
    await lender.mutation(api.tools.create, {
      category: "other",
      condition: "good",
      description: "",
      name: "E2E ladder abc",
    });
    expect(await count(t, "tools")).toBe(17);

    expect(await t.mutation(internal.seed.removeE2E, {})).toMatch(
      /Removed 2 /u
    );
    expect(await count(t, "tools")).toBe(16);
    expect(await count(t, "users")).toBe(9);
  });
});

test("a delivery whose row was cleaned up completes quietly", async () => {
  const { t } = await setup();
  await t.mutation(internal.seed.demo, {});
  const row = await t.run(async (ctx) => {
    const first = await ctx.db.query("notificationOutbox").first();
    await ctx.db.delete(first!._id);
    return first!;
  });
  await expect(
    t.mutation(internal.notifications.onDelivered, {
      context: { outboxId: row._id },
      result: { kind: "success", returnValue: null },
      workId: "work_1" as WorkId,
    })
  ).resolves.toBeNull();
});
