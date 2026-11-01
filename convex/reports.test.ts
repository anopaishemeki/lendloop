import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { addDays, todayUtc } from "./lib/dates";
import type { ReportStatus } from "./lib/validators";
import { identityFor, newTest } from "./test.setup";

async function setup() {
  const t = newTest();
  const as = async (subject: string, role?: "admin") => {
    const caller = t.withIdentity(identityFor(subject, role));
    const userId = await caller.mutation(api.users.syncCurrentUser, {});
    return { caller, userId };
  };
  const owner = await as("olive");
  const ben = await as("ben");
  const otto = await as("otto");
  const admin = await as("root", "admin");
  const toolId = await owner.caller.mutation(api.tools.create, {
    category: "other",
    condition: "worn",
    description: "",
    name: "Rusty saw",
  });
  return { admin, ben, otto, owner, t, toolId };
}

type Setup = Awaited<ReturnType<typeof setup>>;

function report({ toolId }: Setup, who: Setup["ben"], details?: string) {
  return who.caller.mutation(api.reports.create, {
    reason: "unsafe",
    toolId,
    ...(details === undefined ? {} : { details }),
  });
}

function dismiss(s: Setup, reportId: Id<"reports">) {
  return s.admin.caller.mutation(api.admin.dismissReport, { reportId });
}

async function queue(s: Setup, status?: ReportStatus) {
  const { page } = await s.admin.caller.query(api.admin.listReports, {
    paginationOpts: { cursor: null, numItems: 20 },
    status,
  });
  return page;
}

describe("reports.create", () => {
  test("files an open report with trimmed details", async () => {
    const s = await setup();
    await report(s, s.ben, "  Blade is loose  ");
    expect(await queue(s, "open")).toEqual([
      expect.objectContaining({
        availability: "available",
        details: "Blade is loose",
        owner: { isTrustedLender: false, name: "olive" },
        reason: "unsafe",
        reporter: { isTrustedLender: false, name: "ben" },
        status: "open",
        toolId: s.toolId,
        toolName: "Rusty saw",
      }),
    ]);
  });

  test("refuses signed-out callers, owners and repeat reports", async () => {
    const s = await setup();
    await expect(
      s.t.mutation(api.reports.create, { reason: "spam", toolId: s.toolId })
    ).rejects.toThrow(/Sign in/u);
    await expect(report(s, s.owner)).rejects.toThrow(/your own listing/u);
    await report(s, s.ben);
    await expect(report(s, s.ben)).rejects.toThrow(/already reported/u);
    // Someone else may still report it.
    await report(s, s.otto);
    expect(await queue(s, "open")).toHaveLength(2);
  });

  test("a dismissed report can't be reopened by reporting again", async () => {
    const s = await setup();
    await report(s, s.ben);
    const [open] = await queue(s, "open");
    await dismiss(s, open!._id);
    await expect(report(s, s.ben)).rejects.toThrow(/already reported/u);
    expect(await queue(s, "open")).toEqual([]);
  });

  test("refuses removed listings", async () => {
    const s = await setup();
    await s.owner.caller.mutation(api.tools.remove, { toolId: s.toolId });
    await expect(report(s, s.ben)).rejects.toThrow(/no longer listed/u);
  });
});

describe("admin report queue", () => {
  test("is for admins only", async () => {
    const s = await setup();
    await expect(
      s.ben.caller.query(api.admin.listReports, {
        paginationOpts: { cursor: null, numItems: 5 },
      })
    ).rejects.toThrow();
    await report(s, s.otto);
    const [open] = await queue(s);
    await expect(
      s.ben.caller.mutation(api.admin.dismissReport, { reportId: open!._id })
    ).rejects.toThrow();
  });

  test("dismissing closes one report and keeps the listing", async () => {
    const s = await setup();
    await report(s, s.ben);
    await report(s, s.otto);
    const [latest] = await queue(s, "open");
    await dismiss(s, latest!._id);
    expect(await queue(s, "open")).toHaveLength(1);
    expect(await queue(s, "dismissed")).toHaveLength(1);
    expect(
      await s.ben.caller.query(api.tools.get, { toolId: s.toolId })
    ).not.toBeNull();
  });

  test("an admin removing the listing closes every open report", async () => {
    const s = await setup();
    const day = (offset: number) => addDays(todayUtc(), offset);
    const loanId: Id<"loans"> = await s.ben.caller.mutation(api.loans.request, {
      endDate: day(2),
      startDate: day(1),
      toolId: s.toolId,
    });
    await report(s, s.ben);
    await report(s, s.otto);
    const [first] = await queue(s, "open");
    await s.admin.caller.mutation(api.tools.remove, { toolId: s.toolId });

    expect(await queue(s, "open")).toEqual([]);
    const actioned = await queue(s, "actioned");
    expect(actioned).toHaveLength(2);
    expect(actioned.every((r) => r.availability === undefined)).toBe(true);
    const loan = await s.t.run((ctx) => ctx.db.get(loanId));
    expect(loan?.status).toBe("declined");
    await expect(dismiss(s, first!._id)).rejects.toThrow(/already resolved/u);
  });

  test("the overview counts open reports", async () => {
    const s = await setup();
    const openReports = async () =>
      (await s.admin.caller.query(api.admin.overview, {})).openReports;
    await report(s, s.ben);
    await report(s, s.otto);
    expect(await openReports()).toBe(2);
    const [latest] = await queue(s, "open");
    await dismiss(s, latest!._id);
    expect(await openReports()).toBe(1);
  });

  test("an owner removing the listing leaves its reports for an admin", async () => {
    const s = await setup();
    await report(s, s.ben);
    await s.owner.caller.mutation(api.tools.remove, { toolId: s.toolId });
    const [open, ...rest] = await queue(s, "open");
    expect(rest).toEqual([]);
    expect(open?.status).toBe("open");
    expect(open?.availability).toBeUndefined();
  });
});

describe("reports.setDetails (internal)", () => {
  test("replaces, cleans and clears a report's details", async () => {
    const s = await setup();
    await report(s, s.ben, "first draft");
    const [open] = await queue(s, "open");
    const details = async () => (await queue(s, "open"))[0]?.details;

    await s.t.mutation(internal.reports.setDetails, {
      details: "  The chuck wobbles at speed.  ",
      reportId: open!._id,
    });
    expect(await details()).toBe("The chuck wobbles at speed.");

    await s.t.mutation(internal.reports.setDetails, {
      details: "",
      reportId: open!._id,
    });
    expect(await details()).toBeUndefined();
  });
});
