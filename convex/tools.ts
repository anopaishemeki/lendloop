import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import {
  assertToolOwner,
  assertToolOwnerOrAdmin,
  isSelf,
  requireViewer,
  type Viewer,
} from "./auth";
import { mutation } from "./functions";
import { availabilityOf, availabilityValidator } from "./lib/availability";
import { todayUtc } from "./lib/dates";
import { cachedGet, findActiveTool, getActiveTool, mapPage } from "./lib/db";
import { enforceRateLimit } from "./lib/limits";
import { removeListing } from "./lib/listings";
import { cleanText } from "./lib/text";
import { publicProfile } from "./lib/users";
import {
  categoryValidator,
  conditionValidator,
  TOOL_DESCRIPTION_MAX,
  TOOL_NAME_MAX,
  TOOL_NAME_MIN,
} from "./lib/validators";

const PUBLIC_LIMIT = 100;
const PUBLIC_BATCH = 25;

const toolFields = {
  category: categoryValidator,
  condition: conditionValidator,
  description: v.string(),
  name: v.string(),
};

const toolView = v.object({
  _id: v.id("tools"),
  availability: availabilityValidator,
  category: categoryValidator,
  condition: conditionValidator,
  description: v.string(),
  isMine: v.boolean(),
  name: v.string(),
  owner: v.object({ firstName: v.string(), isTrustedLender: v.boolean() }),
});

export type ToolView = typeof toolView.type;

const publicToolView = v.object({
  category: categoryValidator,
  name: v.string(),
});

function cleanFields(args: { name: string; description: string }) {
  return {
    description: cleanText(
      args.description,
      "Description",
      0,
      TOOL_DESCRIPTION_MAX
    ),
    name: cleanText(args.name, "Name", TOOL_NAME_MIN, TOOL_NAME_MAX),
  };
}

/** Builds card views, loading each owner once per query instead of once per tool. */
function viewBuilder(ctx: QueryCtx, viewer: Viewer) {
  const today = todayUtc();
  const get = cachedGet(ctx, viewer.user);

  return async (tool: Doc<"tools">) => {
    const [owner, availability] = await Promise.all([
      get(tool.ownerId),
      availabilityOf(ctx, tool._id, today),
    ]);
    return {
      _id: tool._id,
      availability,
      category: tool.category,
      condition: tool.condition,
      description: tool.description,
      isMine: isSelf(viewer, tool.ownerId),
      name: tool.name,
      owner: publicProfile(owner),
    };
  };
}

/**
 * Public, unauthenticated list for the landing page. The returns validator
 * pins the shape to name and category so nothing else can leak.
 */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const today = todayUtc();
    const visible: (typeof publicToolView.type)[] = [];
    let batch: Doc<"tools">[] = [];

    const flush = async () => {
      const availability = await Promise.all(
        batch.map((tool) => availabilityOf(ctx, tool._id, today))
      );
      batch.forEach((tool, i) => {
        if (availability[i] === "available" && visible.length < PUBLIC_LIMIT) {
          visible.push({ category: tool.category, name: tool.name });
        }
      });
      batch = [];
    };

    const listed = ctx.db
      .query("tools")
      .withIndex("by_removed_at", (q) => q.eq("removedAt", undefined))
      .order("desc");
    for await (const tool of listed) {
      batch.push(tool);
      if (batch.length === PUBLIC_BATCH) {
        await flush();
        if (visible.length >= PUBLIC_LIMIT) break;
      }
    }
    await flush();
    return visible;
  },
  returns: v.array(publicToolView),
});

/** Live listings, newest first, a page at a time. */
export const list = query({
  args: {
    category: v.optional(categoryValidator),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { category, paginationOpts }) => {
    const viewer = await requireViewer(ctx);
    const listed = category
      ? ctx.db
          .query("tools")
          .withIndex("by_category_and_removed_at", (q) =>
            q.eq("category", category).eq("removedAt", undefined)
          )
      : ctx.db
          .query("tools")
          .withIndex("by_removed_at", (q) => q.eq("removedAt", undefined));
    const result = await listed.order("desc").paginate(paginationOpts);
    return await mapPage(result, viewBuilder(ctx, viewer));
  },
  returns: paginationResultValidator(toolView),
});

/**
 * One live listing, or null when it was removed or the id from the URL isn't a
 * tool id at all, so pages can say so instead of erroring.
 */
export const get = query({
  args: { toolId: v.string() },
  handler: async (ctx, { toolId }) => {
    const viewer = await requireViewer(ctx);
    const id = ctx.db.normalizeId("tools", toolId);
    const tool = id ? await findActiveTool(ctx, id) : null;
    return tool ? await viewBuilder(ctx, viewer)(tool) : null;
  },
  returns: v.union(toolView, v.null()),
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_owner_and_removed_at", (q) =>
        q.eq("ownerId", viewer.user._id).eq("removedAt", undefined)
      )
      .order("desc")
      .collect();
    return await Promise.all(tools.map(viewBuilder(ctx, viewer)));
  },
  returns: v.array(toolView),
});

export const create = mutation({
  args: toolFields,
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const fields = cleanFields(args);
    await enforceRateLimit(ctx, viewer, "newListing");
    return await ctx.db.insert("tools", {
      ...args,
      ...fields,
      ownerId: viewer.user._id,
      updatedAt: Date.now(),
    });
  },
  returns: v.id("tools"),
});

export const update = mutation({
  args: { toolId: v.id("tools"), ...toolFields },
  handler: async (ctx, { toolId, ...args }) => {
    const viewer = await requireViewer(ctx);
    const tool = await getActiveTool(ctx, toolId);
    assertToolOwner(viewer, tool);
    await ctx.db.patch(toolId, {
      ...args,
      ...cleanFields(args),
      updatedAt: Date.now(),
    });
    return null;
  },
  returns: v.null(),
});

/** Owners remove their own listings; admins any (see removeListing). */
export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const viewer = await requireViewer(ctx);
    const tool = await getActiveTool(ctx, toolId);
    assertToolOwnerOrAdmin(viewer, tool);
    await removeListing(ctx, viewer, tool);
    return null;
  },
  returns: v.null(),
});
