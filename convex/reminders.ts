import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { daysBetween, isIsoDate } from "./lib/dates";
import { cachedGet } from "./lib/db";
import { firstName } from "./lib/users";
import { reminderStatusValidator } from "./lib/validators";

const OVERDUE_BATCH = 200;
const MAX_ERROR_LENGTH = 500;

export function reminderKey(loanId: string, reminderDate: string) {
  return `${loanId}:${reminderDate}`;
}

/**
 * What n8n needs to email one borrower: their own address, first names, the
 * tool and dates. The loan id and idempotency key let n8n write the result back.
 */
const overdueLoanValidator = v.object({
  appUrl: v.string(),
  borrower: v.object({ email: v.string(), firstName: v.string() }),
  daysOverdue: v.number(),
  dueDate: v.string(),
  idempotencyKey: v.string(),
  loanId: v.id("loans"),
  ownerFirstName: v.string(),
  reminderDate: v.string(),
  toolName: v.string(),
});

/** Approved loans past their end date that have not had today's reminder sent. */
export const listOverdue = internalQuery({
  args: { appUrl: v.string(), today: v.string() },
  handler: async (ctx, { appUrl, today }) => {
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_status_and_end_date", (q) =>
        q.eq("status", "approved").lt("endDate", today)
      )
      .take(OVERDUE_BATCH);

    const get = cachedGet(ctx);
    const rows = await Promise.all(
      loans.map(async (loan) => {
        const idempotencyKey = reminderKey(loan._id, today);
        const [sent, borrower, owner, tool] = await Promise.all([
          ctx.db
            .query("reminders")
            .withIndex("by_idempotency_key", (q) =>
              q.eq("idempotencyKey", idempotencyKey)
            )
            .unique(),
          get(loan.borrowerId),
          get(loan.ownerId),
          get(loan.toolId),
        ]);
        if (sent?.status === "sent" || !borrower?.email) return null;
        return {
          appUrl: `${appUrl}/my/requests`,
          borrower: {
            email: borrower.email,
            firstName: firstName(borrower.name),
          },
          daysOverdue: daysBetween(loan.endDate, today),
          dueDate: loan.endDate,
          idempotencyKey,
          loanId: loan._id,
          ownerFirstName: owner ? firstName(owner.name) : "the owner",
          reminderDate: today,
          toolName: tool?.name ?? "the tool",
        };
      })
    );
    return rows.filter((row) => row !== null);
  },
  returns: v.array(overdueLoanValidator),
});

/**
 * Idempotent write-back keyed on loan + reminder date: a retried or replayed
 * call never creates a second row. A later "sent" upgrades an earlier "failed"
 * (n8n retried the email); anything else is reported as a duplicate.
 */
export const recordReminder = internalMutation({
  args: {
    error: v.optional(v.string()),
    idempotencyKey: v.string(),
    loanId: v.string(),
    reminderDate: v.string(),
    status: reminderStatusValidator,
  },
  handler: async (ctx, args) => {
    const loanId = ctx.db.normalizeId("loans", args.loanId);
    if (!(loanId && isIsoDate(args.reminderDate))) {
      return { result: "invalid" as const };
    }
    if (args.idempotencyKey !== reminderKey(loanId, args.reminderDate)) {
      return { result: "invalid" as const };
    }
    if (!(await ctx.db.get(loanId))) return { result: "invalid" as const };

    const error = args.error?.slice(0, MAX_ERROR_LENGTH);
    const existing = await ctx.db
      .query("reminders")
      .withIndex("by_idempotency_key", (q) =>
        q.eq("idempotencyKey", args.idempotencyKey)
      )
      .unique();
    if (existing) {
      if (existing.status === "failed" && args.status === "sent") {
        await ctx.db.patch(existing._id, { error: undefined, status: "sent" });
        return { result: "updated" as const };
      }
      return { result: "duplicate" as const };
    }
    await ctx.db.insert("reminders", {
      idempotencyKey: args.idempotencyKey,
      loanId,
      reminderDate: args.reminderDate,
      status: args.status,
      ...(error && args.status === "failed" ? { error } : {}),
    });
    return { result: "created" as const };
  },
  returns: v.object({
    result: v.union(
      v.literal("created"),
      v.literal("updated"),
      v.literal("duplicate"),
      v.literal("invalid")
    ),
  }),
});
