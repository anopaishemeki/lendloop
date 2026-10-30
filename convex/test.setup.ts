/// <reference types="vite/client" />
import type { UserIdentity } from "convex/server";
import type { Role } from "./auth";

// Must stay `./**/*.*s`: convex-test locates the `_generated` folder from the keys.
export const modules = import.meta.glob("./**/*.*s");

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
