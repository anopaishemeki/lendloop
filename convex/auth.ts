import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type Role = "admin" | "user";

export type ErrorCode =
  | "UNAUTHENTICATED"
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

// The role claim comes from Clerk publicMetadata via the session token. Anything
// other than the exact string "admin" is a regular user.
export function roleFromIdentity(identity: UserIdentity): Role {
  return identity.role === "admin" ? "admin" : "user";
}

async function requireIdentity(ctx: QueryCtx): Promise<UserIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) fail("UNAUTHENTICATED", "Sign in to continue.");
  return identity;
}

function findUser(ctx: QueryCtx, clerkId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
}

export function profileFromIdentity(identity: UserIdentity) {
  const email = identity.email ?? "";
  const name =
    identity.name?.trim() ||
    [identity.givenName, identity.familyName].filter(Boolean).join(" ") ||
    email.split("@")[0] ||
    "Neighbor";
  return { email, name };
}

/**
 * Query-side guard. Queries cannot write, so a signed-in caller whose profile
 * row has not been created yet gets `user: null`; callers decide how to treat it.
 */
export async function getViewer(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await findUser(ctx, identity.subject);
  return { identity, role: roleFromIdentity(identity), user };
}

export async function requireViewer(ctx: QueryCtx): Promise<Viewer> {
  const identity = await requireIdentity(ctx);
  const user = await findUser(ctx, identity.subject);
  if (!user) fail("UNAUTHENTICATED", "Your profile is still being set up.");
  return { identity, role: roleFromIdentity(identity), user };
}

/** Mutation-side guard: creates or refreshes the caller's profile row. */
export async function requireViewerForWrite(ctx: MutationCtx): Promise<Viewer> {
  const identity = await requireIdentity(ctx);
  const profile = profileFromIdentity(identity);
  const existing = await findUser(ctx, identity.subject);
  if (existing) {
    if (existing.email !== profile.email || existing.name !== profile.name) {
      await ctx.db.patch(existing._id, profile);
    }
    const user = (await ctx.db.get(existing._id))!;
    return { identity, role: roleFromIdentity(identity), user };
  }
  const id = await ctx.db.insert("users", {
    ...profile,
    clerkId: identity.subject,
    createdAt: Date.now(),
    isTrustedLender: false,
  });
  const user = (await ctx.db.get(id))!;
  return { identity, role: roleFromIdentity(identity), user };
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
