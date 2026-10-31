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

export const LOAN_MAX_DAYS = 30;
export const LOAN_MAX_ADVANCE_DAYS = 180;
export const LOAN_NOTE_MAX = 300;

export const LOAN_STATUSES = [
  "requested",
  "approved",
  "declined",
  "cancelled",
  "returned",
] as const;

/** Statuses a loan never leaves; transitionLoan stamps closedAt on them. */
export const CLOSED_LOAN_STATUSES = [
  "returned",
  "declined",
  "cancelled",
] as const;
export const LOAN_ROLES = ["owner", "borrower"] as const;
export const BOARD_SECTIONS = ["pending", "active", "history"] as const;

export const NOTIFICATION_EVENTS = [
  "request.created",
  "request.approved",
  "request.declined",
  "request.cancelled",
  "loan.returned",
] as const;

export const DELIVERY_STATUSES = ["pending", "sent", "failed"] as const;
export const REMINDER_STATUSES = ["sent", "failed"] as const;
/**
 * The aggregate component instances behind the admin overview counters, shared
 * by convex.config.ts, convex/lib/counters.ts and the test setup.
 */
export const COUNTER_COMPONENTS = [
  "loanCounts",
  "userCounts",
  "toolCounts",
  "deliveryCounts",
  "reminderCounts",
] as const;
/** Failed deliveries re-queued per redrive (CLI or the admin Retry button). */
export const REDRIVE_LIMIT = 100;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];
export type ToolCondition = (typeof TOOL_CONDITIONS)[number];
export type LoanStatus = (typeof LOAN_STATUSES)[number];
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export type LoanRole = (typeof LOAN_ROLES)[number];
export type BoardSection = (typeof BOARD_SECTIONS)[number];

function literals<T extends string>(values: readonly [T, T, ...T[]]) {
  const [first, second, ...rest] = values.map((value) => v.literal(value));
  return v.union(first!, second!, ...rest);
}

export const categoryValidator = literals(TOOL_CATEGORIES);
export const conditionValidator = literals(TOOL_CONDITIONS);
export const loanStatusValidator = literals(LOAN_STATUSES);
export const loanRoleValidator = literals(LOAN_ROLES);
export const boardSectionValidator = literals(BOARD_SECTIONS);
export const notificationEventValidator = literals(NOTIFICATION_EVENTS);
export const deliveryStatusValidator = literals(DELIVERY_STATUSES);
export const reminderStatusValidator = literals(REMINDER_STATUSES);
