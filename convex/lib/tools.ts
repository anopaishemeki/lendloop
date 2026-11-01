import type { Trigger } from "convex-helpers/server/triggers";
import type { DataModel, Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** The tool fields loans and reports keep a copy of, for admin search and filters. */
export function toolFieldsOf(
  tool: Pick<Doc<"tools">, "name" | "category" | "condition">
) {
  return {
    toolCategory: tool.category,
    toolCondition: tool.condition,
    toolName: tool.name,
  };
}

/**
 * Trigger on tools: when a tool's name, category or condition changes (by any
 * write path), refresh the copy its loans and reports keep. Registered in convex/functions.ts.
 */
export const syncToolCopies: Trigger<MutationCtx, DataModel, "tools"> = async (
  ctx,
  { newDoc, oldDoc }
) => {
  if (!(oldDoc && newDoc)) return;
  const fields = toolFieldsOf(newDoc);
  const before = toolFieldsOf(oldDoc);
  if (
    fields.toolName === before.toolName &&
    fields.toolCategory === before.toolCategory &&
    fields.toolCondition === before.toolCondition
  ) {
    return;
  }
  const [loans, reports] = await Promise.all([
    ctx.db
      .query("loans")
      .withIndex("by_tool_and_status_and_start_date", (q) =>
        q.eq("toolId", newDoc._id)
      )
      .collect(),
    ctx.db
      .query("reports")
      .withIndex("by_tool_and_reporter", (q) => q.eq("toolId", newDoc._id))
      .collect(),
  ]);
  await Promise.all(
    [...loans, ...reports].map((row) => ctx.db.patch(row._id, fields))
  );
};
