import type { MutationCtx } from "../_generated/server";

const MAX_ERROR_LENGTH = 300;

export type FailureKind = "delivery" | "reminder";

/**
 * Queues one failed delivery or reminder for the next ops alert (sent by the
 * cron in convex/crons.ts). An insert with no reads, so failures arriving
 * together during an outage never conflict.
 */
export async function noteFailure(
  ctx: MutationCtx,
  kind: FailureKind,
  error: string
) {
  await ctx.db.insert("pendingAlerts", {
    error: error.slice(0, MAX_ERROR_LENGTH),
    kind,
  });
}
