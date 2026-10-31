import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";
import { internalMutation } from "./functions";
import { daysBetween, isIsoDate } from "./lib/dates";
import { cachedGet } from "./lib/db";
import { overdueLoans } from "./lib/loans";
import { firstName, isTrustedLender } from "./lib/users";
import { reminderStatusValidator } from "./lib/validators";

/** Loans per reminder run; hourly runs work through a larger backlog. */
export const OVERDUE_BATCH = 200;
/** Overdue loans one run reads at most, well inside Convex's read limits. */
const MAX_SCANNED = 4000;
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
 * The next batch of overdue loans owed a reminder today, oldest due date
 * first. Loans already sent one today are skipped, and loans not yet tried
 * today come before today's failed sends, so loans that keep failing can't
 * crowd out the rest: each hourly run works further through a backlog and
 * retries failures only with room to spare. Borrowers without an email are
 * skipped before they take a slot.
 */
export const listOverdue = internalQuery({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const remindedToday = await ctx.db
      .query("reminders")
      .withIndex("by_reminder_date", (q) => q.eq("reminderDate", today))
      .collect();
    const statusToday = new Map(remindedToday.map((r) => [r.loanId, r.status]));

    const get = cachedGet(ctx);
    type Due = { loan: Doc<"loans">; borrower: Doc<"users"> };
    const untried: Due[] = [];
    const failed: Due[] = [];
    let scanned = 0;
    for await (const loan of overdueLoans(ctx, today)) {
      const status = statusToday.get(loan._id);
      const queue = status === "failed" ? failed : untried;
      if (status !== "sent" && queue.length < OVERDUE_BATCH) {
        const borrower = await get(loan.borrowerId);
        if (borrower?.email) queue.push({ borrower, loan });
      }
      scanned += 1;
      if (untried.length >= OVERDUE_BATCH) break;
      if (scanned >= MAX_SCANNED) {
        console.warn("Overdue scan cap reached; later loans wait", { today });
        break;
      }
    }
    const due = [...untried, ...failed].slice(0, OVERDUE_BATCH);

    return await Promise.all(
      due.map(async ({ borrower, loan }) => {
        const [owner, tool] = await Promise.all([
          get(loan.ownerId),
          get(loan.toolId),
        ]);
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
