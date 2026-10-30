import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { addDays, todayUtc } from "./lib/dates";
import schema from "./schema";
import { identityFor, modules } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
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

describe("admin queries and mutations reject non-admins", () => {
  test.each([
    [
      "listLoans",
      (c: Awaited<ReturnType<typeof setup>>["owner"]["caller"]) =>
        c.query(api.admin.listLoans, {}),
    ],
    [
      "listTools",
      (c: Awaited<ReturnType<typeof setup>>["owner"]["caller"]) =>
        c.query(api.admin.listTools, {}),
    ],
    [
      "listUsers",
      (c: Awaited<ReturnType<typeof setup>>["owner"]["caller"]) =>
        c.query(api.admin.listUsers, {}),
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
    await expect(t.query(api.admin.listLoans, {})).rejects.toThrow(/Sign in/u);
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
    const loans = await admin.caller.query(api.admin.listLoans, {});
    expect(loans).toHaveLength(1);
    expect(loans[0]).toMatchObject({
      borrowerName: "ben",
      isOverdue: true,
      ownerName: "olive",
      toolName: "Tent",
    });
    expect(
      await admin.caller.query(api.admin.listLoans, { status: "returned" })
    ).toEqual([]);
  });

  test("lists live tools and can remove any of them", async () => {
    const { admin, toolId } = await setup();
    expect(await admin.caller.query(api.admin.listTools, {})).toMatchObject([
      { availability: "available", name: "Tent", ownerName: "olive" },
    ]);
    await admin.caller.mutation(api.tools.remove, { toolId });
    expect(await admin.caller.query(api.admin.listTools, {})).toEqual([]);
  });
});

describe("trusted lender", () => {
  test("an admin toggles the badge shown on the owner's tools", async () => {
    const { admin, borrower, owner } = await setup();
    await admin.caller.mutation(api.admin.setTrustedLender, {
      trusted: true,
      userId: owner.userId,
    });
    const [tool] = await borrower.caller.query(api.tools.list, {});
    expect(tool?.owner.isTrustedLender).toBe(true);
    const users = await admin.caller.query(api.admin.listUsers, {});
    expect(users.find((u) => u._id === owner.userId)?.isTrustedLender).toBe(
      true
    );
  });
});
