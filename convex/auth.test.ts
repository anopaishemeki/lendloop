import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { identityFor, newTest } from "./test.setup";

describe("users.syncCurrentUser", () => {
  test("rejects signed-out callers", async () => {
    const t = newTest();
    await expect(t.mutation(api.users.syncCurrentUser, {})).rejects.toThrow(
      /Sign in/u
    );
  });

  test("creates one profile per Clerk user and is idempotent", async () => {
    const t = newTest();
    const alice = t.withIdentity(identityFor("alice"));
    const first = await alice.mutation(api.users.syncCurrentUser, {});
    const second = await alice.mutation(api.users.syncCurrentUser, {});
    expect(second).toEqual(first);
    const rows = await t.run((ctx) => ctx.db.query("users").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      clerkId: "alice",
      email: "alice@example.test",
      isTrustedLender: false,
    });
  });
});

describe("users.me", () => {
  test("is null when signed out or not yet synced", async () => {
    const t = newTest();
    expect(await t.query(api.users.me, {})).toBeNull();
    expect(
      await t.withIdentity(identityFor("bob")).query(api.users.me, {})
    ).toBeNull();
  });

  test("derives admin only from the exact role claim", async () => {
    const t = newTest();
    const cases = [
      { expected: true, role: "admin" as const, subject: "root" },
      { expected: false, role: "user" as const, subject: "carol" },
      { expected: false, role: undefined, subject: "dave" },
    ];
    for (const { expected, role, subject } of cases) {
      const caller = t.withIdentity(identityFor(subject, role));
      await caller.mutation(api.users.syncCurrentUser, {});
      const me = await caller.query(api.users.me, {});
      expect(me?.isAdmin).toBe(expected);
    }
  });

  test("ignores wrong-cased or top-level role claims", async () => {
    const t = newTest();
    const caller = t.withIdentity({
      ...identityFor("eve"),
      metadata: { role: "Admin" },
      role: "admin",
    });
    await caller.mutation(api.users.syncCurrentUser, {});
    expect((await caller.query(api.users.me, {}))?.isAdmin).toBe(false);
  });
});

describe("profile refresh", () => {
  test("a token without email keeps the stored address", async () => {
    const t = newTest();
    await t
      .withIdentity(identityFor("frank"))
      .mutation(api.users.syncCurrentUser, {});
    await t
      .withIdentity({ ...identityFor("frank"), email: undefined })
      .mutation(api.users.syncCurrentUser, {});
    const row = await t.run((ctx) => ctx.db.query("users").first());
    expect(row?.email).toBe("frank@example.test");
  });

  test("never uses the email as a display name", async () => {
    const t = newTest();
    await t
      .withIdentity({ ...identityFor("gina"), name: undefined })
      .mutation(api.users.syncCurrentUser, {});
    const row = await t.run((ctx) => ctx.db.query("users").first());
    expect(row?.name).toBe("Neighbor");
  });
});
