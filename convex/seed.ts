// biome-ignore-all lint/performance/noAwaitInLoops: seed writes go one at a time, since the counter triggers share trees.
import { v } from "convex/values";
import type { Id, TableNames } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./functions";
import { addDays, dayStartMs, todayUtc } from "./lib/dates";
import { isClosedStatus, recipientOf, toolFieldsOf } from "./lib/loans";
import type {
  LoanStatus,
  NotificationEvent,
  ToolCategory,
  ToolCondition,
} from "./lib/validators";
import { reminderKey } from "./reminders";

/**
 * Demo data for a fresh or showcase deployment: neighbors, listings, loans in
 * every state, their email history, overdue reminders and listing reports, all
 * dated relative to today. Run from the CLI (internal only):
 *   npx convex run seed:demo          add it (skipped if already there)
 *   npx convex run seed:removeDemo    take it out again
 *   npx convex run seed:removeE2E     clear what end-to-end runs left behind
 *
 * Demo neighbors can't sign in (they have no Clerk account) and their
 * addresses are Resend's test inbox, so the hourly reminder run and any
 * request to their tools email nobody real. Rows are written directly, not
 * through transitionLoan, so seeding itself sends nothing.
 */

const DEMO_CLERK_PREFIX = "demo_";
const E2E_EMAIL_PREFIX = "delivered+lendloop-e2e-";
const HOUR_MS = 3_600_000;

type Neighbor = { slug: string; name: string; trusted?: boolean };

const NEIGHBORS: Neighbor[] = [
  { name: "Maya Patel", slug: "maya", trusted: true },
  { name: "Jonah Brooks", slug: "jonah" },
  { name: "Priya Nair", slug: "priya", trusted: true },
  { name: "Sam Okafor", slug: "sam" },
  { name: "Elena Rossi", slug: "elena" },
  { name: "Tom Fischer", slug: "tom" },
  { name: "Grace Kim", slug: "grace", trusted: true },
  { name: "Luis Ortega", slug: "luis" },
];

type ToolSeed = {
  key: string;
  owner: string;
  name: string;
  category: ToolCategory;
  condition: ToolCondition;
  description: string;
};

const TOOLS: ToolSeed[] = [
  {
    category: "power_tools",
    condition: "good",
    description:
      "Two batteries and a charger, plus a box of wood and masonry bits.",
    key: "drill",
    name: "Cordless drill (18V)",
    owner: "maya",
  },
  {
    category: "power_tools",
    condition: "good",
    description:
      "7¼-inch blade, replaced this spring. Safety glasses included.",
    key: "saw",
    name: "Circular saw",
    owner: "maya",
  },
  {
    category: "garden",
    condition: "good",
    description:
      "Mulches or bags. The battery lasts about 40 minutes; charger included.",
    key: "mower",
    name: "Electric lawn mower",
    owner: "jonah",
  },
  {
    category: "garden",
    condition: "fair",
    description: "Cordless, 22-inch blade. Best on branches under 2 cm.",
    key: "trimmer",
    name: "Hedge trimmer",
    owner: "jonah",
  },
  {
    category: "kitchen",
    condition: "new",
    description: "5-quart bowl with whisk, paddle and dough hook.",
    key: "mixer",
    name: "Stand mixer",
    owner: "priya",
  },
  {
    category: "kitchen",
    condition: "good",
    description: "Hand-crank roller with fettuccine and spaghetti cutters.",
    key: "pasta",
    name: "Pasta maker",
    owner: "priya",
  },
  {
    category: "camping",
    condition: "good",
    description:
      "Freestanding, up in ten minutes. Footprint and stakes are in the bag.",
    key: "tent",
    name: "Four-person tent",
    owner: "sam",
  },
  {
    category: "camping",
    condition: "good",
    description: "Two burners on standard propane canisters (not included).",
    key: "stove",
    name: "Camping stove",
    owner: "sam",
  },
  {
    category: "hand_tools",
    condition: "good",
    description: "Metric and imperial, ¼ and ⅜ drive, in a carry case.",
    key: "sockets",
    name: "Socket set",
    owner: "elena",
  },
  {
    category: "hand_tools",
    condition: "new",
    description:
      "Stud finder and laser level: shelves straight the first time.",
    key: "level",
    name: "Laser level & stud finder",
    owner: "elena",
  },
  {
    category: "cleaning",
    condition: "good",
    description:
      "Upright deep cleaner. Half a bottle of solution is still inside.",
    key: "carpet",
    name: "Carpet cleaner",
    owner: "tom",
  },
  {
    category: "cleaning",
    condition: "fair",
    description: "1,800 PSI electric with a 25 ft hose. Great on decks.",
    key: "washer",
    name: "Pressure washer",
    owner: "tom",
  },
  {
    category: "other",
    condition: "good",
    description:
      "Aluminium, rated to 135 kg. You'll need a roof rack to carry it.",
    key: "ladder",
    name: "Extension ladder (7 m)",
    owner: "grace",
  },
  {
    category: "other",
    condition: "good",
    description: "Two six-foot folding tables for parties or yard sales.",
    key: "tables",
    name: "Folding tables (pair)",
    owner: "grace",
  },
  {
    category: "garden",
    condition: "worn",
    description: "Sturdy, but the grips are tired. Pump the tyre up first.",
    key: "barrow",
    name: "Wheelbarrow",
    owner: "luis",
  },
  {
    category: "hand_tools",
    condition: "good",
    description: "Manual 60 cm cutter; scores ceramic and porcelain cleanly.",
    key: "tiles",
    name: "Tile cutter",
    owner: "luis",
  },
];

type LoanSeed = {
  tool: string;
  borrower: string;
  /** Days from today. */
  start: number;
  end: number;
  status: LoanStatus;
  note?: string;
  /** Day the request was made (default: three days before the start). */
  requested?: number;
  /** Day the loan was approved, declined or cancelled. */
  decided?: number;
  /** Day it came back (returned loans). */
  returned?: number;
  /** Who cancelled (cancelled loans). */
  cancelledBy?: "owner" | "borrower";
  /** Reminder days (from today) and outcomes, for overdue loans. */
  reminders?: [number, "sent" | "failed"][];
};

const LOANS: LoanSeed[] = [
  // History
  {
    borrower: "jonah",
    decided: -22,
    end: -18,
    returned: -18,
    start: -20,
    status: "returned",
    tool: "drill",
  },
  {
    borrower: "maya",
    decided: -16,
    end: -13,
    returned: -13,
    start: -15,
    status: "returned",
    tool: "trimmer",
  },
  {
    borrower: "priya",
    decided: -13,
    end: -9,
    note: "Long weekend in the hills.",
    returned: -9,
    start: -12,
    status: "returned",
    tool: "tent",
  },
  {
    borrower: "elena",
    decided: -9,
    end: -6,
    note: "Garage sale on Saturday.",
    returned: -6,
    start: -7,
    status: "returned",
    tool: "tables",
  },
  {
    borrower: "grace",
    decided: -4,
    end: -1,
    requested: -5,
    start: -2,
    status: "declined",
    tool: "sockets",
  },
  {
    borrower: "tom",
    cancelledBy: "borrower",
    decided: -3,
    end: 2,
    requested: -5,
    start: 1,
    status: "cancelled",
    tool: "pasta",
  },
  // Out now, upcoming and overdue
  {
    borrower: "elena",
    decided: -4,
    end: 3,
    note: "Front and back lawns.",
    requested: -5,
    start: -2,
    status: "approved",
    tool: "mower",
  },
  {
    borrower: "grace",
    decided: -1,
    end: 6,
    note: "Baking for the school fair.",
    requested: -2,
    start: 4,
    status: "approved",
    tool: "mixer",
  },
  {
    borrower: "sam",
    decided: -8,
    end: -3,
    reminders: [
      [-2, "sent"],
      [-1, "sent"],
    ],
    start: -6,
    status: "approved",
    tool: "washer",
  },
  {
    borrower: "tom",
    decided: -11,
    end: -5,
    note: "Clearing the gutters before the rain.",
    reminders: [
      [-4, "sent"],
      [-3, "failed"],
      [-2, "sent"],
      [-1, "sent"],
    ],
    start: -9,
    status: "approved",
    tool: "ladder",
  },
  // Waiting for the lender
  {
    borrower: "luis",
    end: 3,
    note: "Cutting plywood for a raised garden bed.",
    requested: -1,
    start: 2,
    status: "requested",
    tool: "saw",
  },
  {
    borrower: "maya",
    end: 12,
    note: "Weekend trip to the lake.",
    requested: -1,
    start: 10,
    status: "requested",
    tool: "stove",
  },
  {
    borrower: "jonah",
    end: 6,
    requested: -2,
    start: 5,
    status: "requested",
    tool: "level",
  },
];

/** Each email a seeded loan sent: event, recipient and day, in order. */
function historyOf(
  seed: LoanSeed,
  loan: { borrowerId: Id<"users">; ownerId: Id<"users"> }
): [NotificationEvent, Id<"users">, number][] {
  const requested = seed.requested ?? seed.start - 3;
  const decided = seed.decided ?? requested;
  const actorId = seed.cancelledBy === "owner" ? loan.ownerId : loan.borrowerId;
  const to = (status: LoanStatus) => recipientOf(loan, status, actorId);
  const history: [NotificationEvent, Id<"users">, number][] = [
    ["request.created", loan.ownerId, requested],
  ];
  if (seed.status === "declined" || seed.status === "cancelled") {
    history.push([`request.${seed.status}`, to(seed.status), decided]);
  } else if (seed.status !== "requested") {
    history.push(["request.approved", to("approved"), decided]);
    if (seed.status === "returned") {
      history.push([
        "loan.returned",
        to("returned"),
        seed.returned ?? seed.end,
      ]);
    }
  }
  return history;
}

/** Demo neighbors' clerkIds all start with "demo_"; "demo`" sorts right after. */
function demoUsers(ctx: MutationCtx) {
  return ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) =>
      q.gte("clerkId", DEMO_CLERK_PREFIX).lt("clerkId", "demo`")
    )
    .collect();
}

export const demo = internalMutation({
  args: {},
  handler: async (ctx) => {
    if ((await demoUsers(ctx)).length > 0) {
      return "Demo data is already there; run seed:removeDemo first.";
    }

    const today = todayUtc();
    const now = Date.now();
    // A moment on a seeded day, never in the future.
    const at = (offset: number, hour = 10) =>
      Math.min(
        dayStartMs(addDays(today, offset)) + hour * HOUR_MS,
        now - HOUR_MS
      );

    const people = new Map<string, Id<"users">>();
    for (const neighbor of NEIGHBORS) {
      people.set(
        neighbor.slug,
        await ctx.db.insert("users", {
          clerkId: `${DEMO_CLERK_PREFIX}${neighbor.slug}`,
          email: `delivered+lendloop-demo-${neighbor.slug}@resend.dev`,
          isTrustedLender: neighbor.trusted ?? false,
          name: neighbor.name,
        })
      );
    }
    const person = (slug: string) => people.get(slug)!;

    const toolIds = new Map<string, Id<"tools">>();
    for (const seed of TOOLS) {
      toolIds.set(
        seed.key,
        await ctx.db.insert("tools", {
          category: seed.category,
          condition: seed.condition,
          description: seed.description,
          name: seed.name,
          ownerId: person(seed.owner),
          updatedAt: now,
        })
      );
    }
    const toolSeeds = new Map(TOOLS.map((tool) => [tool.key, tool]));

    for (const seed of LOANS) {
      const tool = toolSeeds.get(seed.tool)!;
      const parties = {
        borrowerId: person(seed.borrower),
        ownerId: person(tool.owner),
      };
      const decidedAt =
        seed.decided === undefined ? undefined : at(seed.decided, 18);
      const returnedAt =
        seed.returned === undefined ? undefined : at(seed.returned, 17);
      const loanId = await ctx.db.insert("loans", {
        ...parties,
        ...toolFieldsOf(tool),
        endDate: addDays(today, seed.end),
        startDate: addDays(today, seed.start),
        status: seed.status,
        toolId: toolIds.get(seed.tool)!,
        ...(seed.note ? { note: seed.note } : {}),
        ...(decidedAt ? { decidedAt } : {}),
        ...(returnedAt ? { returnedAt } : {}),
        ...(isClosedStatus(seed.status)
          ? { closedAt: returnedAt ?? decidedAt ?? now }
          : {}),
      });

      for (const [event, recipientId, day] of historyOf(seed, parties)) {
        await ctx.db.insert("notificationOutbox", {
          attempts: 1,
          event,
          loanId,
          recipientId,
          sentAt: at(day, event === "request.created" ? 9 : 18) + 60_000,
          status: "sent",
        });
      }
      for (const [day, status] of seed.reminders ?? []) {
        const reminderDate = addDays(today, day);
        await ctx.db.insert("reminders", {
          idempotencyKey: reminderKey(loanId, reminderDate),
          loanId,
          reminderDate,
          status,
          updatedAt: at(day, 8),
          ...(status === "failed"
            ? { error: "Resend responded 429 (rate limited)" }
            : {}),
        });
      }
    }

    await ctx.db.insert("reports", {
      details: "Listed as good, but the blade guide is cracked.",
      reason: "misleading",
      reporterId: person("jonah"),
      status: "open",
      toolId: toolIds.get("tiles")!,
    });
    await ctx.db.insert("reports", {
      details: "The tyre was flat when I picked it up.",
      reason: "other",
      reporterId: person("priya"),
      resolvedAt: at(-5, 12),
      status: "dismissed",
      toolId: toolIds.get("barrow")!,
    });

    return `Seeded ${NEIGHBORS.length} neighbors, ${TOOLS.length} listings and ${LOANS.length} loans.`;
  },
  returns: v.string(),
});

/**
 * Deletes these users and everything tied to them: their listings and the
 * reports on them, every loan they're part of, and those loans' email rows and
 * reminders. Index lookups throughout, so it reads only what it deletes.
 */
async function removeUsersAndData(ctx: MutationCtx, userIds: Id<"users">[]) {
  const doomed = new Set<Id<TableNames>>(userIds);
  for (const userId of userIds) {
    const [tools, owned, borrowed] = await Promise.all([
      ctx.db
        .query("tools")
        .withIndex("by_owner_and_removed_at", (q) => q.eq("ownerId", userId))
        .collect(),
      ctx.db
        .query("loans")
        .withIndex("by_owner_closed", (q) => q.eq("ownerId", userId))
        .collect(),
      ctx.db
        .query("loans")
        .withIndex("by_borrower_closed", (q) => q.eq("borrowerId", userId))
        .collect(),
    ]);
    for (const tool of tools) {
      doomed.add(tool._id);
      const reports = await ctx.db
        .query("reports")
        .withIndex("by_tool_and_reporter", (q) => q.eq("toolId", tool._id))
        .collect();
      for (const report of reports) doomed.add(report._id);
    }
    for (const loan of [...owned, ...borrowed]) {
      doomed.add(loan._id);
      const [outbox, reminders] = await Promise.all([
        ctx.db
          .query("notificationOutbox")
          .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
          .collect(),
        ctx.db
          .query("reminders")
          .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
          .collect(),
      ]);
      for (const row of [...outbox, ...reminders]) doomed.add(row._id);
    }
  }
  // Counter triggers share trees, so the deletes go one at a time.
  for (const id of doomed) await ctx.db.delete(id);
  return doomed.size;
}

export const removeDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await demoUsers(ctx);
    const removed = await removeUsersAndData(
      ctx,
      users.map((user) => user._id)
    );
    return `Removed ${removed} demo rows.`;
  },
  returns: v.string(),
});

/** Clears the end-to-end users' profiles and data; the next run re-creates them. */
export const removeE2E = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Three users and no email index: a scan of the (small) users table.
    const users = (await ctx.db.query("users").collect()).filter((user) =>
      user.email.startsWith(E2E_EMAIL_PREFIX)
    );
    const removed = await removeUsersAndData(
      ctx,
      users.map((user) => user._id)
    );
    return `Removed ${removed} end-to-end test rows.`;
  },
  returns: v.string(),
});
