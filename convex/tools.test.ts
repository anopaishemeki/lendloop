import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { addDays, todayUtc } from "./lib/dates";
import { identityFor, newTest } from "./test.setup";

const drill = {
  category: "power_tools" as const,
  condition: "good" as const,
  description: "18V cordless, two batteries",
  name: "Cordless drill",
};

async function setup() {
  const t = newTest();
  const as = async (subject: string, role?: "admin") => {
    const caller = t.withIdentity(identityFor(subject, role));
    const userId = await caller.mutation(api.users.syncCurrentUser, {});
    return { caller, userId };
  };
  const alice = await as("alice");
  const bob = await as("bob");
  const admin = await as("root", "admin");
  return { admin, alice, bob, t };
}

function insertLoan(
  t: ReturnType<typeof newTest>,
  loan: {
    toolId: Id<"tools">;
    ownerId: Id<"users">;
    borrowerId: Id<"users">;
    startDate: string;
    endDate: string;
    status: "requested" | "approved";
  }
) {
  return t.run((ctx) => ctx.db.insert("loans", loan));
}

describe("tools.listPublic", () => {
  test("exposes only name and category of available, listed tools", async () => {
    const { alice, bob, t } = await setup();
    await alice.caller.mutation(api.tools.create, drill);
    const lentId = await alice.caller.mutation(api.tools.create, {
      ...drill,
      name: "Ladder",
    });
    const goneId = await alice.caller.mutation(api.tools.create, {
      ...drill,
      name: "Old saw",
    });
    await alice.caller.mutation(api.tools.remove, { toolId: goneId });
    await insertLoan(t, {
      borrowerId: bob.userId,
      endDate: addDays(todayUtc(), 2),
      ownerId: alice.userId,
      startDate: todayUtc(),
      status: "approved",
      toolId: lentId,
    });

    const result = await t.query(api.tools.listPublic, {});
    expect(result).toEqual([
      { category: "power_tools", name: "Cordless drill" },
    ]);
  });
});

describe("tools.create", () => {
  test("requires sign-in", async () => {
    const t = newTest();
    await expect(t.mutation(api.tools.create, drill)).rejects.toThrow(
      /Sign in/u
    );
  });

  test("trims input and owns the tool as the caller", async () => {
    const { alice, t } = await setup();
    const id = await alice.caller.mutation(api.tools.create, {
      ...drill,
      name: "  Drill  ",
    });
    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row).toMatchObject({ name: "Drill", ownerId: alice.userId });
  });

  test.each([
    ["too short name", { name: "x" }],
    ["too long name", { name: "x".repeat(81) }],
    ["too long description", { description: "x".repeat(501) }],
    ["control characters", { name: "Drill\u0007" }],
  ])("rejects %s", async (_label, override) => {
    const { alice } = await setup();
    await expect(
      alice.caller.mutation(api.tools.create, { ...drill, ...override })
    ).rejects.toThrow(/characters/u);
  });
});

test("allows tabs and newlines in descriptions", async () => {
  const { alice, t } = await setup();
  const description = "Includes:\n\t2 batteries";
  const id = await alice.caller.mutation(api.tools.create, {
    ...drill,
    description,
  });
  const row = await t.run((ctx) => ctx.db.get(id));
  expect(row?.description).toBe(description);
});

describe("tools.update", () => {
  test("only the owner may edit, not other users or admins", async () => {
    const { admin, alice, bob } = await setup();
    const toolId = await alice.caller.mutation(api.tools.create, drill);
    const edit = { ...drill, name: "Hammer drill", toolId };
    await expect(bob.caller.mutation(api.tools.update, edit)).rejects.toThrow(
      /owner/u
    );
    await expect(admin.caller.mutation(api.tools.update, edit)).rejects.toThrow(
      /owner/u
    );
    await alice.caller.mutation(api.tools.update, edit);
    const tool = await alice.caller.query(api.tools.get, { toolId });
    expect(tool?.name).toBe("Hammer drill");

    await alice.caller.mutation(api.tools.remove, { toolId });
    expect(await alice.caller.query(api.tools.get, { toolId })).toBeNull();
    // Not a tool id at all (a stale or mistyped URL) also answers null.
    expect(
      await alice.caller.query(api.tools.get, { toolId: "not-an-id" })
    ).toBeNull();
  });
});

describe("tools.remove", () => {
  test("other users cannot remove; admins can remove any listing", async () => {
    const { admin, alice, bob } = await setup();
    const toolId = await alice.caller.mutation(api.tools.create, drill);
    await expect(
      bob.caller.mutation(api.tools.remove, { toolId })
    ).rejects.toThrow(/owner or an admin/u);
    await admin.caller.mutation(api.tools.remove, { toolId });
    expect(await alice.caller.query(api.tools.listMine, {})).toEqual([]);
  });

  test("declines open requests and blocks the owner while the tool is out", async () => {
    const { alice, bob, t } = await setup();
    const toolId = await alice.caller.mutation(api.tools.create, drill);
    const pending = await insertLoan(t, {
      borrowerId: bob.userId,
      endDate: addDays(todayUtc(), 9),
      ownerId: alice.userId,
      startDate: addDays(todayUtc(), 8),
      status: "requested",
      toolId,
    });
    await alice.caller.mutation(api.tools.remove, { toolId });
    expect((await t.run((ctx) => ctx.db.get(pending)))?.status).toBe(
      "declined"
    );

    const lentTool = await alice.caller.mutation(api.tools.create, drill);
    await insertLoan(t, {
      borrowerId: bob.userId,
      endDate: addDays(todayUtc(), 1),
      ownerId: alice.userId,
      startDate: addDays(todayUtc(), -1),
      status: "approved",
      toolId: lentTool,
    });
    await expect(
      alice.caller.mutation(api.tools.remove, { toolId: lentTool })
    ).rejects.toThrow(/out on loan/u);
  });
});

describe("tools.list", () => {
  type Caller = Awaited<ReturnType<typeof setup>>["bob"]["caller"];
  const list = (
    caller: Caller,
    {
      category,
      cursor = null,
      numItems = 10,
    }: { category?: "garden"; cursor?: string | null; numItems?: number } = {}
  ) =>
    caller.query(api.tools.list, {
      category,
      paginationOpts: { cursor, numItems },
    });

  test("pages newest first", async () => {
    const { alice, bob } = await setup();
    for (const name of ["Drill", "Saw", "Ladder"]) {
      await alice.caller.mutation(api.tools.create, { ...drill, name });
    }
    const first = await list(bob.caller, { numItems: 2 });
    expect(first.page.map((tool) => tool.name)).toEqual(["Ladder", "Saw"]);
    const rest = await list(bob.caller, {
      cursor: first.continueCursor,
      numItems: 2,
    });
    expect(rest.page.map((tool) => tool.name)).toEqual(["Drill"]);
    expect(rest.isDone).toBe(true);
  });

  test("filters by category and shows only the owner's first name", async () => {
    const { alice, bob } = await setup();
    await alice.caller.mutation(api.tools.create, drill);
    await alice.caller.mutation(api.tools.create, {
      ...drill,
      category: "garden",
      name: "Rake",
    });
    const { page: garden } = await list(bob.caller, { category: "garden" });
    expect(garden.map((tool) => tool.name)).toEqual(["Rake"]);
    expect(garden[0]).toMatchObject({
      availability: "available",
      isMine: false,
      owner: { firstName: "alice", isTrustedLender: false },
    });
  });
});
