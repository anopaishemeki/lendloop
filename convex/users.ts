import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getViewer, requireViewerForWrite } from "./auth";

const meValidator = v.object({
  _id: v.id("users"),
  email: v.string(),
  isAdmin: v.boolean(),
  isTrustedLender: v.boolean(),
  name: v.string(),
});

/** Called by the client right after sign-in so queries can find the profile. */
export const syncCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewerForWrite(ctx);
    return viewer.user._id;
  },
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
