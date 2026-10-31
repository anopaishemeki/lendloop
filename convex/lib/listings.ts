import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { fail, type Viewer } from "../auth";
import { isOnLoan } from "./availability";
import { todayUtc } from "./dates";
import { loansForTool, transitionLoan } from "./loans";

/**
 * Soft-deletes a listing so loan history survives. Open requests are declined,
 * upcoming approved loans cancelled. When an admin removes it, open reports
 * about it close as actioned; an owner's removal leaves them open for an admin
 * to review. A tool that is out right now can only be removed by an admin; that
 * loan stays approved so it can still be returned. Callers check permission.
 */
export async function removeListing(
  ctx: MutationCtx,
  viewer: Viewer,
  tool: Doc<"tools">
) {
  const today = todayUtc();
  const now = Date.now();
  const actorId = viewer.user._id;
  const isAdmin = viewer.role === "admin";
  const [requested, approved, reports] = await Promise.all([
    loansForTool(ctx, tool._id, "requested"),
    loansForTool(ctx, tool._id, "approved"),
    isAdmin
      ? ctx.db
          .query("reports")
          .withIndex("by_tool_and_status", (q) =>
            q.eq("toolId", tool._id).eq("status", "open")
          )
          .collect()
      : [],
  ]);
  if (!isAdmin && approved.some((loan) => isOnLoan(loan, today))) {
    fail("CONFLICT", "This tool is out on loan. Mark it returned first.");
  }
  await Promise.all([
    ...requested.map((loan) =>
      transitionLoan(ctx, loan, "declined", { actorId, now })
    ),
    ...approved
      .filter((loan) => !isOnLoan(loan, today))
      .map((loan) => transitionLoan(ctx, loan, "cancelled", { actorId, now })),
    ...reports.map((report) =>
      ctx.db.patch(report._id, {
        resolvedAt: now,
        resolvedBy: actorId,
        status: "actioned",
      })
    ),
  ]);
  await ctx.db.patch(tool._id, { removedAt: now, removedBy: actorId });
}
