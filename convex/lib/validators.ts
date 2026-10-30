import { v } from "convex/values";

export const TOOL_CATEGORIES = [
  "power_tools",
  "hand_tools",
  "garden",
  "kitchen",
  "camping",
  "cleaning",
  "other",
] as const;

export const TOOL_CONDITIONS = ["new", "good", "fair", "worn"] as const;

export const LOAN_STATUSES = [
  "requested",
  "approved",
  "declined",
  "cancelled",
  "returned",
] as const;

export const NOTIFICATION_EVENTS = [
  "request.created",
  "request.approved",
  "request.declined",
  "request.cancelled",
  "loan.returned",
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];
export type ToolCondition = (typeof TOOL_CONDITIONS)[number];
export type LoanStatus = (typeof LOAN_STATUSES)[number];
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export const categoryValidator = v.union(
  ...TOOL_CATEGORIES.map((c) => v.literal(c))
);
export const conditionValidator = v.union(
  ...TOOL_CONDITIONS.map((c) => v.literal(c))
);
export const loanStatusValidator = v.union(
  ...LOAN_STATUSES.map((s) => v.literal(s))
);
export const notificationEventValidator = v.union(
  ...NOTIFICATION_EVENTS.map((e) => v.literal(e))
);
export const deliveryStatusValidator = v.union(
  v.literal("pending"),
  v.literal("sent"),
  v.literal("failed")
);
export const reminderStatusValidator = v.union(
  v.literal("sent"),
  v.literal("failed")
);
