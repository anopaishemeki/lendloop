import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { type Role, roleFromMetadata } from "./lib/roles";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "PROFILE_PENDING"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_ARGUMENT"
  | "INVALID_TRANSITION"
  | "CONFLICT";

export type Viewer = {
  identity: UserIdentity;
  role: Role;
  user: Doc<"users">;
};

export function fail(code: ErrorCode, message: string): never {
  throw new ConvexError({ code, message });
}

function findUser(ctx: QueryCtx, clerkId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
}

// Only claims actually present are returned, so a token that omits one never
// overwrites a stored value with a blank.
function profileFromIdentity(identity: UserIdentity) {
  const profile: { email?: string; name?: string } = {};
  if (identity.email) profile.email = identity.email;
  const name =
    identity.name?.trim() ||
    [identity.givenName, identity.familyName].filter(Boolean).join(" ");
  if (name) profile.name = name;
  return profile;
}

/** `null` when signed out; `user` is null until the profile row exists. */
export async function getViewer(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await findUser(ctx, identity.subject);
  return { identity, role: roleFromMetadata(identity.metadata), user };
}

/** Guard for every query and mutation. Never writes. */
export async function requireViewer(ctx: QueryCtx): Promise<Viewer> {
  const viewer = await getViewer(ctx);
  if (!viewer) fail("UNAUTHENTICATED", "Sign in to continue.");
  const { user } = viewer;
  if (!user) fail("PROFILE_PENDING", "Your profile is still being set up.");
  return { ...viewer, user };
}

/** Creates or refreshes the caller's profile row from the Clerk identity. */
export async function upsertProfile(ctx: MutationCtx): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) fail("UNAUTHENTICATED", "Sign in to continue.");
  const profile = profileFromIdentity(identity);
  const existing = await findUser(ctx, identity.subject);
  if (!existing) {
    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: profile.email ?? "",
      isTrustedLender: false,
      // Never derive a display name from the email: other users see it.
      name: profile.name ?? "Neighbor",
    });
  }
  const changed = (Object.keys(profile) as (keyof typeof profile)[]).some(
    (key) => profile[key] !== existing[key]
  );
  if (changed) await ctx.db.patch(existing._id, profile);
  return existing._id;
}

export function assertAdmin(viewer: Viewer) {
  if (viewer.role !== "admin") fail("FORBIDDEN", "Admins only.");
}

export async function requireAdmin(ctx: QueryCtx): Promise<Viewer> {
  const viewer = await requireViewer(ctx);
  assertAdmin(viewer);
  return viewer;
}

export function isSelf(viewer: Viewer, userId: Id<"users">) {
  return viewer.user._id === userId;
}

export function assertToolOwner(viewer: Viewer, tool: Doc<"tools">) {
  if (!isSelf(viewer, tool.ownerId)) {
    fail("FORBIDDEN", "Only the owner can change this listing.");
  }
}

export function assertToolOwnerOrAdmin(viewer: Viewer, tool: Doc<"tools">) {
  if (viewer.role !== "admin" && !isSelf(viewer, tool.ownerId)) {
    fail("FORBIDDEN", "Only the owner or an admin can do that.");
  }
}

export type LoanParty = "owner" | "borrower";

export function assertLoanParty(
  viewer: Viewer,
  loan: Doc<"loans">,
  ...parties: LoanParty[]
) {
  const allowed = parties.some((party) =>
    isSelf(viewer, party === "owner" ? loan.ownerId : loan.borrowerId)
  );
  if (!allowed) fail("FORBIDDEN", "You are not part of this loan.");
}
