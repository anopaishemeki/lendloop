import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getViewer, upsertProfile } from "./auth";
import schema from "./schema";

const meValidator = schema.tables.users.validator
  .pick("email", "isTrustedLender", "name")
  .extend({ _id: v.id("users"), isAdmin: v.boolean() });

/** Called by the client after sign-in; the signed-in app renders once it resolves. */
export const syncCurrentUser = mutation({
  args: {},
  handler: (ctx) => upsertProfile(ctx),
  returns: v.id("users"),
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx);
    if (!viewer?.user) return null;
    const { _id, email, isTrustedLender, name } = viewer.user;
    return {
      _id,
      email,
      isAdmin: viewer.role === "admin",
      isTrustedLender,
      name,
    };
  },
  returns: v.union(meValidator, v.null()),
});
