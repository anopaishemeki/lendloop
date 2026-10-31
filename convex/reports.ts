import { v } from "convex/values";
import { fail, isSelf, requireViewer } from "./auth";
import { mutation } from "./functions";
import { getActiveTool } from "./lib/db";
import { enforceRateLimit } from "./lib/limits";
import { cleanText } from "./lib/text";
import { REPORT_DETAILS_MAX, reportReasonValidator } from "./lib/validators";

/** A neighbor flags a listing for the admins, once per listing. */
export const create = mutation({
  args: {
    details: v.optional(v.string()),
    reason: reportReasonValidator,
    toolId: v.id("tools"),
  },
  handler: async (ctx, { details, reason, toolId }) => {
    const viewer = await requireViewer(ctx);
    const tool = await getActiveTool(ctx, toolId);
    if (isSelf(viewer, tool.ownerId)) {
      fail("FORBIDDEN", "You can't report your own listing.");
    }
    const cleanDetails = details
      ? cleanText(details, "Details", 0, REPORT_DETAILS_MAX)
      : "";
    // Once ever, so re-reporting can't reopen a dismissed report.
    const earlier = await ctx.db
      .query("reports")
      .withIndex("by_tool_and_reporter", (q) =>
        q.eq("toolId", toolId).eq("reporterId", viewer.user._id)
      )
      .first();
    if (earlier) fail("CONFLICT", "You've already reported this listing.");
    await enforceRateLimit(ctx, viewer, "listingReport");
    await ctx.db.insert("reports", {
      reason,
      reporterId: viewer.user._id,
      status: "open",
      toolId,
      ...(cleanDetails ? { details: cleanDetails } : {}),
    });
    return null;
  },
  returns: v.null(),
});
