import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { addDays, todayUtc } from "./lib/dates";
import { canTransition, isClosedStatus } from "./lib/loans";
import type { BoardSection, LoanRole, LoanStatus } from "./lib/validators";
import { identityFor, newTest } from "./test.setup";

const today = todayUtc();
const day = (offset: number) => addDays(today, offset);

async function setup() {
  const t = newTest();
  const as = async (subject: string, role?: "admin") => {
    const caller = t.withIdentity(identityFor(subject, role));
    const userId = await caller.mutation(api.users.syncCurrentUser, {});
    return { caller, userId };
  };
  const owner = await as("olive");
  const borrower = await as("ben");
  const other = await as("otto");
  const admin = await as("root", "admin");
  const toolId = await owner.caller.mutation(api.tools.create, {
    category: "garden",
    condition: "good",
    description: "",
    name: "Hedge trimmer",
  });
  return { admin, borrower, other, owner, t, toolId };
}

type Setup = Awaited<ReturnType<typeof setup>>;

function requestFor(
  { borrower, toolId }: Setup,
  startDate = day(1),
  endDate = day(3)
) {
  return borrower.caller.mutation(api.loans.request, {
    endDate,
    startDate,
    toolId,
  });
}

/** A board page, read by the person in `role` unless `as` says otherwise. */
function board(
  s: Setup,
  role: LoanRole,
  section: BoardSection,
  {
    as = s[role],
    cursor = null,
    numItems = 10,
  }: { as?: Setup["owner"]; cursor?: string | null; numItems?: number } = {}
) {
  return as.caller.query(api.loans.listBoard, {
    paginationOpts: { cursor, numItems },
    role,
    section,
  });
}

/** Seeds a loan directly, for states the API can't reach on the current date. */
function seedLoan(
  { t, owner, borrower, toolId }: Setup,
  fields: {
    startDate: string;
    endDate: string;
    status: LoanStatus;
  }
) {
  return t.run((ctx) =>
    ctx.db.insert("loans", {
      borrowerId: borrower.userId,
      // transitionLoan stamps closedAt; seeded closed loans need it too.
      ...(isClosedStatus(fields.status) ? { closedAt: Date.now() } : {}),
      ownerId: owner.userId,
      toolId,
      ...fields,
    })
  );
}

async function statusOf(t: Setup["t"], loanId: Id<"loans">) {
  return (await t.run((ctx) => ctx.db.get(loanId)))?.status;
}

describe("state machine", () => {
  test.each([
    ["requested", "approved", true],
    ["requested", "declined", true],
    ["requested", "cancelled", true],
    ["approved", "returned", true],
    ["approved", "cancelled", true],
    ["requested", "returned", false],
    ["approved", "declined", false],
    ["declined", "approved", false],
    ["returned", "approved", false],
    ["cancelled", "requested", false],
  ] as const)("%s -> %s allowed: %s", (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected);
  });
});

describe("loans.request", () => {
  test("creates a pending request owned by the tool owner", async () => {
    const s = await setup();
    const loanId = await requestFor(s);
    const loan = await s.t.run((ctx) => ctx.db.get(loanId));
    expect(loan).toMatchObject({
      borrowerId: s.borrower.userId,
      ownerId: s.owner.userId,
      status: "requested",
    });
  });

  test("owners can't borrow their own tool", async () => {
    const s = await setup();
    await expect(
      s.owner.caller.mutation(api.loans.request, {
        endDate: day(2),
        startDate: day(1),
        toolId: s.toolId,
      })
    ).rejects.toThrow(/own tool/u);
  });

  test.each([
    ["an invalid day", "2026-02-30", "2026-03-01", /valid calendar/u],
    ["a past start", day(-2), day(1), /past/u],
    ["an end before start", day(3), day(2), /on or after/u],
    ["more than 30 days", day(1), day(31), /at most 30/u],
    ["too far ahead", day(181), day(182), /180 days/u],
  ])("rejects %s", async (_label, startDate, endDate, message) => {
    const s = await setup();
    await expect(requestFor(s, startDate, endDate)).rejects.toThrow(message);
  });

  test("rejects dates that overlap an approved loan", async () => {
    const s = await setup();
    await seedLoan(s, {
      endDate: day(5),
      startDate: day(3),
      status: "approved",
    });
    await expect(requestFor(s, day(5), day(6))).rejects.toThrow(
      /already lent/u
    );
    await expect(requestFor(s, day(6), day(7))).resolves.toBeDefined();
  });

  test("an overdue loan keeps blocking dates until it is returned", async () => {
    const s = await setup();
    await seedLoan(s, {
      endDate: day(-3),
      startDate: day(-5),
      status: "approved",
    });
    await expect(requestFor(s, today, day(1))).rejects.toThrow(/already lent/u);
    await expect(
      s.other.caller.query(api.loans.bookedRanges, { toolId: s.toolId })
    ).resolves.toEqual([{ endDate: today, startDate: day(-5) }]);
  });

  test("accepts yesterday's UTC date for viewers west of UTC", async () => {
    const s = await setup();
    await expect(requestFor(s, day(-1), day(1))).resolves.toBeDefined();
  });

  test("rejects a duplicate pending request from the same borrower", async () => {
    const s = await setup();
    await requestFor(s);
    await expect(requestFor(s, day(2), day(4))).rejects.toThrow(/pending/u);
  });

  test("rejects requests on removed tools", async () => {
    const s = await setup();
    await s.owner.caller.mutation(api.tools.remove, { toolId: s.toolId });
    await expect(requestFor(s)).rejects.toThrow(/no longer listed/u);
  });
});

describe("approve and decline", () => {
  test("approving declines other pending requests for overlapping dates", async () => {
    const s = await setup();
    const chosen = await requestFor(s, day(1), day(3));
    const clashing = await s.other.caller.mutation(api.loans.request, {
      endDate: day(4),
      startDate: day(3),
      toolId: s.toolId,
    });
    const later = await s.other.caller.mutation(api.loans.request, {
      endDate: day(9),
      startDate: day(8),
      toolId: s.toolId,
    });
    await s.owner.caller.mutation(api.loans.approve, { loanId: chosen });
    expect(await statusOf(s.t, clashing)).toBe("declined");
    expect(await statusOf(s.t, later)).toBe("requested");
  });

  test("only the tool owner can decide", async () => {
    const s = await setup();
    const loanId = await requestFor(s);
    for (const caller of [s.borrower, s.other, s.admin]) {
      await expect(
        caller.caller.mutation(api.loans.approve, { loanId })
      ).rejects.toThrow(/not part of this loan/u);
      await expect(
        caller.caller.mutation(api.loans.decline, { loanId })
      ).rejects.toThrow(/not part of this loan/u);
    }
    await s.owner.caller.mutation(api.loans.approve, { loanId });
    expect(await statusOf(s.t, loanId)).toBe("approved");
  });

  test("approval is blocked when another approved loan overlaps", async () => {
    const s = await setup();
    const pending = await seedLoan(s, {
      endDate: day(4),
      startDate: day(3),
      status: "requested",
    });
    await seedLoan(s, {
      endDate: day(3),
      startDate: day(1),
      status: "approved",
    });
    await expect(
      s.owner.caller.mutation(api.loans.approve, { loanId: pending })
    ).rejects.toThrow(/already lent/u);
  });

  test("decided requests can't be decided again", async () => {
    const s = await setup();
    const loanId = await requestFor(s);
    await s.owner.caller.mutation(api.loans.decline, { loanId });
    await expect(
      s.owner.caller.mutation(api.loans.approve, { loanId })
    ).rejects.toThrow(/cannot become approved/u);
    await expect(
      s.owner.caller.mutation(api.loans.decline, { loanId })
    ).rejects.toThrow(/Only pending/u);
  });

  test("expired requests can only be declined", async () => {
    const s = await setup();
    const loanId = await seedLoan(s, {
      endDate: day(-1),
      startDate: day(-2),
      status: "requested",
    });
    await expect(
      s.owner.caller.mutation(api.loans.approve, { loanId })
    ).rejects.toThrow(/passed/u);
  });
});

describe("cancel", () => {
  test("borrowers cancel pending requests; owners cannot", async () => {
    const s = await setup();
    const loanId = await requestFor(s);
    await expect(
      s.owner.caller.mutation(api.loans.cancel, { loanId })
    ).rejects.toThrow(/can't be cancelled/u);
    await s.borrower.caller.mutation(api.loans.cancel, { loanId });
    expect(await statusOf(s.t, loanId)).toBe("cancelled");
  });

  test("either party cancels an approved loan before it starts", async () => {
    const s = await setup();
    const loanId = await requestFor(s);
    await s.owner.caller.mutation(api.loans.approve, { loanId });
    await s.owner.caller.mutation(api.loans.cancel, { loanId });
    expect(await statusOf(s.t, loanId)).toBe("cancelled");
  });

  test("a loan that has started can't be cancelled", async () => {
    const s = await setup();
    const loanId = await seedLoan(s, {
      endDate: day(2),
      startDate: today,
      status: "approved",
    });
    await expect(
      s.borrower.caller.mutation(api.loans.cancel, { loanId })
    ).rejects.toThrow(/Mark it returned/u);
  });

  test("outsiders can't cancel", async () => {
    const s = await setup();
    const loanId = await requestFor(s);
    await expect(
      s.other.caller.mutation(api.loans.cancel, { loanId })
    ).rejects.toThrow(/not part of this loan/u);
  });
});

describe("markReturned", () => {
  test("only the owner marks a started loan returned", async () => {
    const s = await setup();
    const loanId = await seedLoan(s, {
      endDate: day(-1),
      startDate: day(-3),
      status: "approved",
    });
    await expect(
      s.borrower.caller.mutation(api.loans.markReturned, { loanId })
    ).rejects.toThrow(/not part of this loan/u);
    await s.owner.caller.mutation(api.loans.markReturned, { loanId });
    const loan = await s.t.run((ctx) => ctx.db.get(loanId));
    expect(loan?.status).toBe("returned");
    expect(loan?.returnedAt).toBeTypeOf("number");
  });

  test("a loan that hasn't started can't be returned", async () => {
    const s = await setup();
    const loanId = await requestFor(s);
    await s.owner.caller.mutation(api.loans.approve, { loanId });
    await expect(
      s.owner.caller.mutation(api.loans.markReturned, { loanId })
    ).rejects.toThrow(/hasn't started/u);
  });

  test("still works after an admin removes the lent tool", async () => {
    const s = await setup();
    const loanId = await seedLoan(s, {
      endDate: day(1),
      startDate: day(-1),
      status: "approved",
    });
    await s.admin.caller.mutation(api.tools.remove, { toolId: s.toolId });
    await s.owner.caller.mutation(api.loans.markReturned, { loanId });
    expect(await statusOf(s.t, loanId)).toBe("returned");
  });
});

describe("views", () => {
  test("each party sees their side, with overdue flagged", async () => {
    const s = await setup();
    await seedLoan(s, {
      endDate: day(-1),
      startDate: day(-3),
      status: "approved",
    });
    const [mine] = (await board(s, "borrower", "active")).page;
    const [incoming] = (await board(s, "owner", "active")).page;
    expect(mine).toMatchObject({
      canMarkReturned: false,
      counterpart: { firstName: "olive" },
      isOverdue: true,
      role: "borrower",
    });
    expect(incoming).toMatchObject({
      canMarkReturned: true,
      counterpart: { firstName: "ben" },
      role: "owner",
    });
    for (const section of ["pending", "active", "history"] as const) {
      expect((await board(s, "owner", section, { as: s.other })).page).toEqual(
        []
      );
    }
  });

  test("open sections lead with the most urgent loan", async () => {
    const s = await setup();
    const later = await seedLoan(s, {
      endDate: day(9),
      startDate: day(8),
      status: "requested",
    });
    const sooner = await seedLoan(s, {
      endDate: day(3),
      startDate: day(2),
      status: "requested",
    });
    const dueLater = await seedLoan(s, {
      endDate: day(5),
      startDate: day(4),
      status: "approved",
    });
    const overdue = await seedLoan(s, {
      endDate: day(-1),
      startDate: day(-3),
      status: "approved",
    });

    const pending = await board(s, "owner", "pending");
    expect(pending.page.map((loan) => loan._id)).toEqual([sooner, later]);
    const active = await board(s, "borrower", "active");
    expect(active.page.map((loan) => loan._id)).toEqual([overdue, dueLater]);
  });

  test("history pages through closed loans only, newest first", async () => {
    const s = await setup();
    const closed: Id<"loans">[] = [];
    for (const status of ["returned", "declined", "cancelled"] as const) {
      closed.push(
        await seedLoan(s, { endDate: day(-1), startDate: day(-2), status })
      );
    }
    await seedLoan(s, {
      endDate: day(3),
      startDate: day(2),
      status: "approved",
    });

    const first = await board(s, "borrower", "history", { numItems: 2 });
    expect(first.page.map((loan) => loan._id)).toEqual([closed[2], closed[1]]);
    expect(first.isDone).toBe(false);
    const rest = await board(s, "borrower", "history", {
      cursor: first.continueCursor,
      numItems: 2,
    });
    expect(rest.page.map((loan) => loan._id)).toEqual([closed[0]]);
    expect((await board(s, "owner", "active")).page).toHaveLength(1);
  });

  test("booked ranges expose dates only", async () => {
    const s = await setup();
    await seedLoan(s, {
      endDate: day(5),
      startDate: day(3),
      status: "approved",
    });
    await requestFor(s, day(8), day(9));
    expect(
      await s.other.caller.query(api.loans.bookedRanges, { toolId: s.toolId })
    ).toEqual([{ endDate: day(5), startDate: day(3) }]);
  });

  test("a removed tool has no booked ranges instead of an error", async () => {
    const s = await setup();
    await s.owner.caller.mutation(api.tools.remove, { toolId: s.toolId });
    expect(
      await s.other.caller.query(api.loans.bookedRanges, { toolId: s.toolId })
    ).toEqual([]);
  });
});

describe("closedAt backfill", () => {
  test("puts loans closed before closedAt existed into history", async () => {
    const s = await setup();
    const old = await s.t.run((ctx) =>
      ctx.db.insert("loans", {
        borrowerId: s.borrower.userId,
        decidedAt: 1,
        endDate: day(-1),
        ownerId: s.owner.userId,
        startDate: day(-2),
        status: "declined",
        toolId: s.toolId,
      })
    );
    expect((await board(s, "borrower", "history")).page).toEqual([]);

    const result = await s.t.mutation(internal.migrations.backfillClosedAt, {});
    expect(result).toMatchObject({ isDone: true, patched: 1 });
    expect(
      (await board(s, "borrower", "history")).page.map((loan) => loan._id)
    ).toEqual([old]);
    // Re-running finds nothing left to do.
    expect(
      await s.t.mutation(internal.migrations.backfillClosedAt, {})
    ).toMatchObject({ patched: 0 });
  });
});

describe("activity", () => {
  test("shows automation outcomes to the loan's parties only", async () => {
    const s = await setup();
    const loanId = await seedLoan(s, {
      endDate: day(-1),
      startDate: day(-3),
      status: "approved",
    });
    await s.t.run(async (ctx) => {
      await ctx.db.insert("notificationOutbox", {
        attempts: 1,
        event: "request.approved",
        loanId,
        recipientId: s.borrower.userId,
        sentAt: Date.now(),
        status: "sent",
      });
      await ctx.db.insert("reminders", {
        error: "Resend 503",
        idempotencyKey: `${loanId}:${today}`,
        loanId,
        reminderDate: today,
        status: "failed",
        updatedAt: Date.now(),
      });
    });

    const mine = await s.borrower.caller.query(api.loans.activity, { loanId });
    expect(mine).toMatchObject([
      { kind: "overdue.reminder", status: "failed", toViewer: true },
      { kind: "request.approved", status: "sent", toViewer: true },
    ]);
    const owners = await s.owner.caller.query(api.loans.activity, { loanId });
    expect(owners.every((item) => !item.toViewer)).toBe(true);
    expect(JSON.stringify(owners)).not.toContain("Resend 503");

    await expect(
      s.other.caller.query(api.loans.activity, { loanId })
    ).rejects.toThrow(/not part of this loan/u);
    await expect(
      s.admin.caller.query(api.loans.activity, { loanId })
    ).resolves.toHaveLength(2);
  });
});

describe("loans.setNote (internal)", () => {
  test("replaces, cleans and clears a loan's note", async () => {
    const s = await setup();
    const loanId = await requestFor(s);
    const note = async () => (await s.t.run((ctx) => ctx.db.get(loanId)))?.note;

    await s.t.mutation(internal.loans.setNote, {
      loanId,
      note: "  Trimming the front hedge.  ",
    });
    expect(await note()).toBe("Trimming the front hedge.");

    await s.t.mutation(internal.loans.setNote, { loanId, note: "" });
    expect(await note()).toBeUndefined();
  });
});
