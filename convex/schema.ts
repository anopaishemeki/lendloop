import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  categoryValidator,
  conditionValidator,
  deliveryStatusValidator,
  loanStatusValidator,
  notificationEventValidator,
  reminderStatusValidator,
  reportReasonValidator,
  reportStatusValidator,
} from "./lib/validators";

export default defineSchema({
  // A borrow request and its lifecycle. Dates are UTC calendar days (YYYY-MM-DD).
  loans: defineTable({
    borrowerId: v.id("users"),
    // Set when the loan reaches a closed status (see CLOSED_LOAN_STATUSES).
    closedAt: v.optional(v.number()),
    decidedAt: v.optional(v.number()),
    endDate: v.string(),
    note: v.optional(v.string()),
    ownerId: v.id("users"),
    returnedAt: v.optional(v.number()),
    startDate: v.string(),
    status: loanStatusValidator,
    // Copies of the tool's name, category and condition so admins can search
    // and filter loans by them (kept in step by tools.update; filled for older
    // loans by migrations:backfillToolCopies).
    toolCategory: v.optional(categoryValidator),
    toolCondition: v.optional(conditionValidator),
    toolId: v.id("tools"),
    toolName: v.optional(v.string()),
  })
    // A person's closed loans, most recently closed first (board history).
    .index("by_owner_closed", ["ownerId", "closedAt"])
    .index("by_borrower_closed", ["borrowerId", "closedAt"])
    // Open loans on the boards, most urgent first: requests by start date,
    // approved loans by end date (so overdue ones lead).
    .index("by_borrower_status_start", ["borrowerId", "status", "startDate"])
    .index("by_borrower_status_end", ["borrowerId", "status", "endDate"])
    .index("by_owner_status_start", ["ownerId", "status", "startDate"])
    .index("by_owner_status_end", ["ownerId", "status", "endDate"])
    .index("by_status", ["status"])
    .index("by_status_and_end_date", ["status", "endDate"])
    .searchIndex("search_tool_name", {
      filterFields: ["status", "toolCategory", "toolCondition"],
      searchField: "toolName",
    })
    .index("by_tool_and_status_and_start_date", [
      "toolId",
      "status",
      "startDate",
    ]),

  // Outbound n8n events: one row per event, updated by the delivery worker.
  notificationOutbox: defineTable({
    attempts: v.number(),
    event: notificationEventValidator,
    // When delivery gave up; the outcomes chart files failures by it.
    failedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    loanId: v.id("loans"),
    recipientId: v.id("users"),
    sentAt: v.optional(v.number()),
    status: deliveryStatusValidator,
  })
    .index("by_loan", ["loanId"])
    .index("by_status", ["status"])
    .index("by_event_and_status", ["event", "status"]),

  // Failures not yet emailed to ops; the alert cron reads and clears them.
  pendingAlerts: defineTable({
    error: v.string(),
    kind: v.union(v.literal("delivery"), v.literal("reminder")),
  }),

  // Overdue reminders written back by n8n; idempotencyKey is unique per loan per day.
  reminders: defineTable({
    error: v.optional(v.string()),
    idempotencyKey: v.string(),
    loanId: v.id("loans"),
    reminderDate: v.string(),
    status: reminderStatusValidator,
    updatedAt: v.number(),
  })
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_loan", ["loanId"])
    .index("by_reminder_date", ["reminderDate"])
    .index("by_status", ["status"]),

  // A neighbor's report about a listing, open until an admin resolves it.
  reports: defineTable({
    details: v.optional(v.string()),
    reason: reportReasonValidator,
    reporterId: v.id("users"),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.id("users")),
    status: reportStatusValidator,
    // Copies of the tool's fields for admin search and filters, as on loans.
    toolCategory: v.optional(categoryValidator),
    toolCondition: v.optional(conditionValidator),
    toolId: v.id("tools"),
    toolName: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_tool_and_reporter", ["toolId", "reporterId"])
    .index("by_tool_and_status", ["toolId", "status"])
    .searchIndex("search_tool_name", {
      filterFields: ["status", "reason", "toolCategory", "toolCondition"],
      searchField: "toolName",
    }),

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
    .index("by_condition_and_removed_at", ["condition", "removedAt"])
    .index("by_category_condition_removed", [
      "category",
      "condition",
      "removedAt",
    ])
    // Admin listing search by name, narrowed by the same filters.
    .searchIndex("search_name", {
      filterFields: ["removedAt", "category", "condition"],
      searchField: "name",
    })
    .index("by_category_and_removed_at", ["category", "removedAt"])
    .index("by_removed_at", ["removedAt"]),

  // Signatures already accepted from n8n, kept until they would be stale anyway,
  // so a captured request can't be replayed inside the freshness window.
  usedSignatures: defineTable({
    expiresAt: v.number(),
    signature: v.string(),
  })
    .index("by_signature", ["signature"])
    .index("by_expires_at", ["expiresAt"]),

  // Profile mirror of the Clerk user. Role is not stored: it is read from the
  // JWT on every call so revoking it in Clerk takes effect immediately.
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    isTrustedLender: v.boolean(),
    name: v.string(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_name", ["name"])
    .index("by_trusted_and_name", ["isTrustedLender", "name"])
    .searchIndex("search_name", {
      filterFields: ["isTrustedLender"],
      searchField: "name",
    }),
});
