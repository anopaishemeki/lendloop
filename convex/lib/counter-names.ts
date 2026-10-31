/**
 * The aggregate component instances behind the admin overview counters. One
 * list shared by convex.config.ts, convex/lib/counters.ts and the test setup.
 */
export const COUNTER_COMPONENTS = [
  "loanCounts",
  "userCounts",
  "toolCounts",
  "deliveryCounts",
  "reminderCounts",
] as const;
