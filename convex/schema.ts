import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  categoryValidator,
  conditionValidator,
  deliveryStatusValidator,
  loanStatusValidator,
  notificationEventValidator,
  reminderStatusValidator,
} from "./lib/validators";

export default defineSchema({
  // A borrow request and its lifecycle. Dates are UTC calendar days (YYYY-MM-DD).
  loans: defineTable({
    borrowerId: v.id("users"),
    decidedAt: v.optional(v.number()),
    endDate: v.string(),
    note: v.optional(v.string()),
    ownerId: v.id("users"),
    returnedAt: v.optional(v.number()),
    startDate: v.string(),
    status: loanStatusValidator,
    toolId: v.id("tools"),
  })
    .index("by_borrower_and_status", ["borrowerId", "status"])
    .index("by_owner_and_status", ["ownerId", "status"])
    .index("by_status", ["status"])
    .index("by_status_and_end_date", ["status", "endDate"])
    .index("by_tool_and_status_and_start_date", [
      "toolId",
      "status",
      "startDate",
    ]),

  // Outbound n8n events: one row per event, updated by the delivery worker.
  notificationOutbox: defineTable({
    attempts: v.number(),
    event: notificationEventValidator,
    lastError: v.optional(v.string()),
    loanId: v.id("loans"),
    sentAt: v.optional(v.number()),
    status: deliveryStatusValidator,
  }).index("by_loan", ["loanId"]),

  // Overdue reminders written back by n8n; idempotencyKey is unique per loan per day.
  reminders: defineTable({
    error: v.optional(v.string()),
    idempotencyKey: v.string(),
    loanId: v.id("loans"),
    reminderDate: v.string(),
    status: reminderStatusValidator,
  })
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_loan", ["loanId"]),

  tools: defineTable({
    category: categoryValidator,
    condition: conditionValidator,
    description: v.string(),
    name: v.string(),
    ownerId: v.id("users"),
    removedAt: v.optional(v.number()),
    removedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  })
    .index("by_owner_and_removed_at", ["ownerId", "removedAt"])
    .index("by_category_and_removed_at", ["category", "removedAt"])
    .index("by_removed_at", ["removedAt"]),

  // Profile mirror of the Clerk user. Role is not stored: it is read from the
  // JWT on every call so revoking it in Clerk takes effect immediately.
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    isTrustedLender: v.boolean(),
    name: v.string(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_name", ["name"]),
});
