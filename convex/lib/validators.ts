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

export const TOOL_NAME_MIN = 2;
export const TOOL_NAME_MAX = 80;
export const TOOL_DESCRIPTION_MAX = 500;

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

export const DELIVERY_STATUSES = ["pending", "sent", "failed"] as const;
export const REMINDER_STATUSES = ["sent", "failed"] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];
export type ToolCondition = (typeof TOOL_CONDITIONS)[number];
export type LoanStatus = (typeof LOAN_STATUSES)[number];
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

function literals<T extends string>(values: readonly [T, T, ...T[]]) {
  const [first, second, ...rest] = values.map((value) => v.literal(value));
  return v.union(first!, second!, ...rest);
}

export const categoryValidator = literals(TOOL_CATEGORIES);
export const conditionValidator = literals(TOOL_CONDITIONS);
export const loanStatusValidator = literals(LOAN_STATUSES);
export const notificationEventValidator = literals(NOTIFICATION_EVENTS);
export const deliveryStatusValidator = literals(DELIVERY_STATUSES);
export const reminderStatusValidator = literals(REMINDER_STATUSES);
