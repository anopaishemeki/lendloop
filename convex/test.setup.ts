/// <reference types="vite/client" />
import workpool from "@convex-dev/workpool/test";
import type { UserIdentity } from "convex/server";
import { convexTest } from "convex-test";
import type { Role } from "./lib/roles";
import schema from "./schema";

// Must stay `./**/*.*s`: convex-test locates the `_generated` folder from the keys.
export const modules = import.meta.glob("./**/*.*s");

/** A convex-test instance with the app's components registered. */
export function newTest() {
  const t = convexTest(schema, modules);
  workpool.register(t, "notificationPool");
  return t;
}

/** A Clerk-shaped identity for `t.withIdentity()`; `metadata` mirrors the session claim. */
export function identityFor(
  subject: string,
  role?: Role
): Partial<UserIdentity> {
  return {
    email: `${subject}@example.test`,
    issuer: "https://clerk.example.test",
    metadata: role ? { role } : {},
    name: subject,
    subject,
    tokenIdentifier: `https://clerk.example.test|${subject}`,
  };
}
