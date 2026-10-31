import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { fail } from "../auth";

/** `ctx.db.get` memoised per query, optionally seeded with documents already loaded. */
export function cachedGet(ctx: QueryCtx, ...known: Doc<TableNames>[]) {
  const cache = new Map<string, Promise<unknown>>(
    known.map((doc) => [doc._id, Promise.resolve(doc)])
  );
  return <T extends TableNames>(id: Id<T>): Promise<Doc<T> | null> => {
    let doc = cache.get(id);
    if (!doc) {
      doc = ctx.db.get(id);
      cache.set(id, doc);
    }
    return doc as Promise<Doc<T> | null>;
  };
}

/** The tool if it exists and hasn't been removed, otherwise null. */
export async function findActiveTool(
  ctx: QueryCtx,
  toolId: Id<"tools">
): Promise<Doc<"tools"> | null> {
  const tool = await ctx.db.get(toolId);
  return tool && tool.removedAt === undefined ? tool : null;
}

export async function getActiveTool(
  ctx: QueryCtx,
  toolId: Id<"tools">
): Promise<Doc<"tools">> {
  const tool = await findActiveTool(ctx, toolId);
  if (!tool) fail("NOT_FOUND", "That tool is no longer listed.");
  return tool;
}
