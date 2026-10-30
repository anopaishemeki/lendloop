import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { addDays, todayUtc } from "./lib/dates";
import schema from "./schema";
import { identityFor, modules } from "./test.setup";

const drill = {
  category: "power_tools" as const,
  condition: "good" as const,
  description: "18V cordless, two batteries",
  name: "Cordless drill",
};

async function setup() {
  const t = convexTest(schema, modules);
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
  t: ReturnType<typeof convexTest>,
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
    const t = convexTest(schema, modules);
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
    expect(tool.name).toBe("Hammer drill");
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
  test("filters by category and shows only the owner's first name", async () => {
    const { alice, bob } = await setup();
    await alice.caller.mutation(api.tools.create, drill);
    await alice.caller.mutation(api.tools.create, {
      ...drill,
      category: "garden",
      name: "Rake",
    });
    const garden = await bob.caller.query(api.tools.list, {
      category: "garden",
    });
    expect(garden.map((tool) => tool.name)).toEqual(["Rake"]);
    expect(garden[0]).toMatchObject({
      availability: "available",
      isMine: false,
      owner: { firstName: "alice", isTrustedLender: false },
    });
  });
});
