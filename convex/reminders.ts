import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";
import { internalMutation } from "./functions";
import { daysBetween, isIsoDate } from "./lib/dates";
import { cachedGet } from "./lib/db";
import { isOverdue, overdueLoans } from "./lib/loans";
import { firstName, isTrustedLender } from "./lib/users";
import { reminderStatusValidator } from "./lib/validators";

const OVERDUE_BATCH = 200;
const MAX_ERROR_LENGTH = 500;

export function reminderKey(loanId: string, reminderDate: string) {
  return `${loanId}:${reminderDate}`;
}

/**
 * What n8n needs to email one borrower: their own address, first names, the
 * tool and dates. The loan id comes back in the write-back; the idempotency key
 * doubles as the Resend Idempotency-Key.
 */
const overdueLoanValidator = v.object({
  borrower: v.object({ email: v.string(), firstName: v.string() }),
  daysOverdue: v.number(),
  dueDate: v.string(),
  idempotencyKey: v.string(),
  loanId: v.id("loans"),
  ownerFirstName: v.string(),
  ownerIsTrustedLender: v.boolean(),
  // Absent once the listing is gone; n8n words the email around it.
  toolName: v.optional(v.string()),
});

/**
 * Overdue loans still owed a reminder today, oldest due date first. Loans
 * already reminded today are skipped before the batch limit applies, so a
 * backlog larger than one batch is worked through by re-running the workflow.
 */
export const listOverdue = internalQuery({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const remindedToday = await ctx.db
      .query("reminders")
      .withIndex("by_reminder_date", (q) => q.eq("reminderDate", today))
      .collect();
    const sent = new Set(
      remindedToday.filter((r) => r.status === "sent").map((r) => r.loanId)
    );

    const due: Doc<"loans">[] = [];
    for await (const loan of overdueLoans(ctx, today)) {
      if (isOverdue(loan, today) && !sent.has(loan._id)) due.push(loan);
      if (due.length >= OVERDUE_BATCH) break;
    }

    const get = cachedGet(ctx);
    const rows = await Promise.all(
      due.map(async (loan) => {
        const [borrower, owner, tool] = await Promise.all([
          get(loan.borrowerId),
          get(loan.ownerId),
          get(loan.toolId),
        ]);
        if (!borrower?.email) return null;
        return {
          borrower: {
            email: borrower.email,
            firstName: firstName(borrower.name),
          },
          daysOverdue: daysBetween(loan.endDate, today),
          dueDate: loan.endDate,
          idempotencyKey: reminderKey(loan._id, today),
          loanId: loan._id,
          ownerFirstName: owner ? firstName(owner.name) : "the owner",
          ownerIsTrustedLender: isTrustedLender(owner),
          toolName: tool?.name,
        };
      })
    );
    return rows.filter((row) => row !== null);
  },
  returns: v.array(overdueLoanValidator),
});

/**
 * Idempotent write-back keyed on loan + reminder date: retries and replays
 * never create a second row. "sent" is final; a later "failed" for the same
 * day only refreshes the stored error.
 */
export const recordReminder = internalMutation({
  args: {
    error: v.optional(v.string()),
    loanId: v.string(),
    reminderDate: v.string(),
    status: reminderStatusValidator,
  },
  handler: async (ctx, { error, loanId: rawId, reminderDate, status }) => {
    const loanId = ctx.db.normalizeId("loans", rawId);
    if (!(loanId && isIsoDate(reminderDate) && (await ctx.db.get(loanId)))) {
      return { result: "invalid" as const };
    }
    const idempotencyKey = reminderKey(loanId, reminderDate);
    const lastError =
      status === "failed"
        ? (error ?? "unknown error").slice(0, MAX_ERROR_LENGTH)
        : undefined;
    const existing = await ctx.db
      .query("reminders")
      .withIndex("by_idempotency_key", (q) =>
        q.eq("idempotencyKey", idempotencyKey)
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("reminders", {
        idempotencyKey,
        loanId,
        reminderDate,
        status,
        updatedAt: Date.now(),
        ...(lastError ? { error: lastError } : {}),
      });
      return { result: "created" as const };
    }
    if (existing.status === "sent") return { result: "duplicate" as const };
    await ctx.db.patch(existing._id, {
      error: lastError,
      status,
      updatedAt: Date.now(),
    });
    return { result: "updated" as const };
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

/** Remembers an accepted signature; false if it was already used (a replay). */
export const claimSignature = internalMutation({
  args: { expiresAt: v.number(), signature: v.string() },
  handler: async (ctx, { expiresAt, signature }) => {
    const used = await ctx.db
      .query("usedSignatures")
      .withIndex("by_signature", (q) => q.eq("signature", signature))
      .unique();
    if (used) return false;
    await ctx.db.insert("usedSignatures", { expiresAt, signature });
    return true;
  },
  returns: v.boolean(),
});

export const purgeUsedSignatures = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("usedSignatures")
      .withIndex("by_expires_at", (q) => q.lt("expiresAt", Date.now()))
      .take(1000);
    await Promise.all(expired.map((row) => ctx.db.delete(row._id)));
    return expired.length;
  },
  returns: v.number(),
});
