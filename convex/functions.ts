import {
  customCtx,
  customMutation,
} from "convex-helpers/server/customFunctions";
import { Triggers } from "convex-helpers/server/triggers";
import type { DataModel } from "./_generated/dataModel";
import {
  type MutationCtx,
  internalMutation as rawInternalMutation,
  mutation as rawMutation,
} from "./_generated/server";
import { COUNTERS } from "./lib/counters";
import { syncToolCopies } from "./lib/tools";

/**
 * Every write to the counted tables also updates the admin overview counters
 * (convex/lib/counters.ts). migrations:backfillAllCounters adds rows written
 * before a counter existed.
 */
const triggers = new Triggers<DataModel>();
triggers.register("loans", COUNTERS.loans.trigger);
triggers.register("notificationOutbox", COUNTERS.notificationOutbox.trigger);
triggers.register("reminders", COUNTERS.reminders.trigger);
triggers.register("reports", COUNTERS.reports.trigger);
triggers.register("tools", COUNTERS.tools.trigger);
// Loans and reports keep a copy of their tool's name, category and condition.
triggers.register("tools", syncToolCopies);
triggers.register("users", COUNTERS.users.trigger);

/** A ctx whose writes also update the counters (tests use it with t.run). */
export function withCounters<Ctx extends MutationCtx>(ctx: Ctx): Ctx {
  return triggers.wrapDB(ctx);
}
const withTriggers = customCtx((ctx: MutationCtx) => withCounters(ctx));

// Use these instead of the ones in ./_generated/server so writes stay counted
// (a lint rule enforces it).
export const mutation = customMutation(rawMutation, withTriggers);
export const internalMutation = customMutation(
  rawInternalMutation,
  withTriggers
);
