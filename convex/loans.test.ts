import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { addDays, todayUtc } from "./lib/dates";
import { canTransition } from "./lib/loans";
import schema from "./schema";
import { identityFor, modules } from "./test.setup";

const today = todayUtc();
const day = (offset: number) => addDays(today, offset);

async function setup() {
  const t = convexTest(schema, modules);
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

/** Seeds a loan directly, for states the API can't reach on the current date. */
function seedLoan(
  { t, owner, borrower, toolId }: Setup,
  fields: {
    startDate: string;
    endDate: string;
    status: "approved" | "requested";
  }
) {
  return t.run((ctx) =>
    ctx.db.insert("loans", {
      borrowerId: borrower.userId,
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
    ["a past start", day(-1), day(1), /past/u],
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
    const first = await requestFor(s, day(1), day(3));
    const second = await s.other.caller.mutation(api.loans.request, {
      endDate: day(4),
      startDate: day(3),
      toolId: s.toolId,
    });
    await s.owner.caller.mutation(api.loans.approve, { loanId: first });
    await expect(
      s.owner.caller.mutation(api.loans.approve, { loanId: second })
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
    const [mine] = await s.borrower.caller.query(api.loans.listMyRequests, {});
    const [incoming] = await s.owner.caller.query(api.loans.listIncoming, {});
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
    expect(await s.other.caller.query(api.loans.listIncoming, {})).toEqual([]);
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
});
