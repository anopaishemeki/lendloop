import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";
import {
  assertToolOwner,
  assertToolOwnerOrAdmin,
  fail,
  isSelf,
  requireViewer,
  type Viewer,
} from "./auth";
import { availabilityOf } from "./lib/availability";
import { todayUtc } from "./lib/dates";
import { cleanText } from "./lib/text";
import { categoryValidator, conditionValidator } from "./lib/validators";

const NAME_MAX = 80;
const DESCRIPTION_MAX = 500;
const PUBLIC_LIMIT = 100;

const toolFields = {
  category: categoryValidator,
  condition: conditionValidator,
  description: v.string(),
  name: v.string(),
};

const toolView = v.object({
  _id: v.id("tools"),
  availability: v.union(v.literal("available"), v.literal("on_loan")),
  category: categoryValidator,
  condition: conditionValidator,
  description: v.string(),
  isMine: v.boolean(),
  name: v.string(),
  owner: v.object({ firstName: v.string(), isTrustedLender: v.boolean() }),
});

function firstName(name: string) {
  return name.split(" ")[0] || name;
}

function cleanFields(args: { name: string; description: string }) {
  return {
    description: cleanText(args.description, "Description", 0, DESCRIPTION_MAX),
    name: cleanText(args.name, "Name", 2, NAME_MAX),
  };
}

/** Builds card views, loading each owner once per query instead of once per tool. */
function viewBuilder(ctx: QueryCtx, viewer: Viewer) {
  const today = todayUtc();
  const owners = new Map<Id<"users">, Promise<Doc<"users"> | null>>();
  const ownerOf = (id: Id<"users">) => {
    let owner = owners.get(id);
    if (!owner) {
      owner = ctx.db.get(id);
      owners.set(id, owner);
    }
    return owner;
  };

  return async (tool: Doc<"tools">) => {
    const [owner, availability] = await Promise.all([
      ownerOf(tool.ownerId),
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
      owner: {
        firstName: owner ? firstName(owner.name) : "Neighbor",
        isTrustedLender: owner?.isTrustedLender ?? false,
      },
    };
  };
}

async function getActiveTool(ctx: QueryCtx, toolId: Id<"tools">) {
  const tool = await ctx.db.get(toolId);
  if (!tool || tool.removedAt !== undefined) {
    fail("NOT_FOUND", "That tool is no longer listed.");
  }
  return tool;
}

/**
 * Public, unauthenticated list for the landing page. The returns validator
 * pins the shape to name and category so nothing else can leak.
 */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const today = todayUtc();
    const visible: { category: Doc<"tools">["category"]; name: string }[] = [];
    const listed = ctx.db
      .query("tools")
      .withIndex("by_removed_at", (q) => q.eq("removedAt", undefined))
      .order("desc");
    for await (const tool of listed) {
      if ((await availabilityOf(ctx, tool._id, today)) === "available") {
        visible.push({ category: tool.category, name: tool.name });
        if (visible.length >= PUBLIC_LIMIT) break;
      }
    }
    return visible;
  },
  returns: v.array(v.object({ category: categoryValidator, name: v.string() })),
});

export const list = query({
  args: { category: v.optional(categoryValidator) },
  handler: async (ctx, { category }) => {
    const viewer = await requireViewer(ctx);
    const tools = category
      ? await ctx.db
          .query("tools")
          .withIndex("by_category_and_removed_at", (q) =>
            q.eq("category", category).eq("removedAt", undefined)
          )
          .order("desc")
          .collect()
      : await ctx.db
          .query("tools")
          .withIndex("by_removed_at", (q) => q.eq("removedAt", undefined))
          .order("desc")
          .collect();
    return await Promise.all(tools.map(viewBuilder(ctx, viewer)));
  },
  returns: v.array(toolView),
});

export const get = query({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const viewer = await requireViewer(ctx);
    return await viewBuilder(ctx, viewer)(await getActiveTool(ctx, toolId));
  },
  returns: toolView,
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", viewer.user._id))
      .order("desc")
      .collect();
    const active = tools.filter((tool) => tool.removedAt === undefined);
    return await Promise.all(active.map(viewBuilder(ctx, viewer)));
  },
  returns: v.array(toolView),
});

export const create = mutation({
  args: toolFields,
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    return await ctx.db.insert("tools", {
      ...args,
      ...cleanFields(args),
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

/**
 * Soft delete so loan history survives. Open requests are declined and
 * upcoming approved loans cancelled. A tool that is currently out can only be
 * removed by an admin; the loan stays approved so it can still be returned.
 */
export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const viewer = await requireViewer(ctx);
    const tool = await getActiveTool(ctx, toolId);
    assertToolOwnerOrAdmin(viewer, tool);

    const today = todayUtc();
    const now = Date.now();
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_tool_and_status", (q) => q.eq("toolId", toolId))
      .collect();
    const isOut = loans.some(
      (loan) => loan.status === "approved" && loan.startDate <= today
    );
    if (isOut && viewer.role !== "admin") {
      fail("CONFLICT", "This tool is out on loan. Mark it returned first.");
    }
    await Promise.all(
      loans.map((loan) => {
        if (loan.status === "requested") {
          return ctx.db.patch(loan._id, { decidedAt: now, status: "declined" });
        }
        if (loan.status === "approved" && loan.startDate > today) {
          return ctx.db.patch(loan._id, {
            decidedAt: now,
            status: "cancelled",
          });
        }
        return null;
      })
    );
    await ctx.db.patch(toolId, { removedAt: now, removedBy: viewer.user._id });
    return null;
  },
  returns: v.null(),
});
