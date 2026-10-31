import { TableAggregate } from "@convex-dev/aggregate";
import { compareValues, type Value } from "convex/values";
import type { Trigger } from "convex-helpers/server/triggers";
import { components } from "../_generated/api";
import type { DataModel, Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { DeliveryStatus, LoanStatus } from "./validators";

/**
 * Maintained counts for the admin overview, kept in step with the tables by
 * the triggers registered in convex/functions.ts, so the overview reads a few
 * counters instead of scanning rows.
 */

export const COUNTED_TABLES = [
  "loans",
  "notificationOutbox",
  "reminders",
  "tools",
  "users",
] as const;
export type CountedTable = (typeof COUNTED_TABLES)[number];

/** How a counter files a row; defined once and shared with its skip check. */
type CounterKey<T extends CountedTable> = {
  namespace?: (doc: Doc<T>) => Value;
  sortKey: (doc: Doc<T>) => Value;
};

/** Loans per status, ordered by end date (so "overdue" is a range count). */
const loanKey = {
  namespace: (loan: Doc<"loans">): LoanStatus => loan.status,
  sortKey: (loan: Doc<"loans">) => loan.endDate,
};
export const loanCounts = new TableAggregate<{
  DataModel: DataModel;
  Key: string;
  Namespace: LoanStatus;
  TableName: "loans";
}>(components.loanCounts, loanKey);

/** Neighbors, keyed 1 for trusted lenders and 0 for everyone else. */
const userKey = {
  sortKey: (user: Doc<"users">) => (user.isTrustedLender ? 1 : 0),
};
export const userCounts = new TableAggregate<{
  DataModel: DataModel;
  Key: number;
  TableName: "users";
}>(components.userCounts, userKey);

/** Listings, keyed 0 while live and 1 once removed. */
const toolKey = {
  sortKey: (tool: Doc<"tools">) => (tool.removedAt === undefined ? 0 : 1),
};
export const toolCounts = new TableAggregate<{
  DataModel: DataModel;
  Key: number;
  TableName: "tools";
}>(components.toolCounts, toolKey);

/** Deliveries per status, ordered by when they were sent (or queued). */
const deliveryKey = {
  namespace: (entry: Doc<"notificationOutbox">): DeliveryStatus => entry.status,
  sortKey: (entry: Doc<"notificationOutbox">) =>
    entry.sentAt ?? entry._creationTime,
};
export const deliveryCounts = new TableAggregate<{
  DataModel: DataModel;
  Key: number;
  Namespace: DeliveryStatus;
  TableName: "notificationOutbox";
}>(components.deliveryCounts, deliveryKey);

/** Overdue reminders written back by n8n, ordered by reminder day. */
const reminderKey = {
  sortKey: (reminder: Doc<"reminders">) => reminder.reminderDate,
};
export const reminderCounts = new TableAggregate<{
  DataModel: DataModel;
  Key: string;
  TableName: "reminders";
}>(components.reminderCounts, reminderKey);

type Counter<T extends CountedTable> = {
  /** Keeps the counter in step with one change to the table. */
  trigger: Trigger<MutationCtx, DataModel, T>;
  /** Adds a row written before the counter existed (no-op if present). */
  backfill: (ctx: MutationCtx, doc: Doc<T>) => Promise<void>;
};

/**
 * A counter's trigger. A new row is always a plain insert: it can't already be
 * counted, since the trigger runs in the inserting transaction. Updates skip
 * the counter when the counted key is unchanged (an attempt count, a profile
 * refresh, a tool edit), and otherwise replace-or-insert, which tolerates rows
 * written before the counter existed; deletes tolerate them too.
 */
function counter<T extends CountedTable>(
  aggregate: {
    insert: (ctx: MutationCtx, doc: Doc<T>) => Promise<void>;
    insertIfDoesNotExist: (ctx: MutationCtx, doc: Doc<T>) => Promise<void>;
    replaceOrInsert: (
      ctx: MutationCtx,
      oldDoc: Doc<T>,
      newDoc: Doc<T>
    ) => Promise<void>;
    deleteIfExists: (ctx: MutationCtx, doc: Doc<T>) => Promise<void>;
  },
  key: CounterKey<T>
): Counter<T> {
  const keyOf = (doc: Doc<T>) => [
    key.namespace?.(doc) ?? null,
    key.sortKey(doc),
  ];
  return {
    backfill: (ctx, doc) => aggregate.insertIfDoesNotExist(ctx, doc),
    trigger: async (ctx, { oldDoc, newDoc }) => {
      if (oldDoc === null) {
        if (newDoc !== null) await aggregate.insert(ctx, newDoc);
      } else if (newDoc === null) {
        await aggregate.deleteIfExists(ctx, oldDoc);
      } else if (compareValues(keyOf(oldDoc), keyOf(newDoc)) !== 0) {
        await aggregate.replaceOrInsert(ctx, oldDoc, newDoc);
      }
    },
  };
}

/** Every counted table and its counter; exhaustive by type. */
export const COUNTERS: { [T in CountedTable]: Counter<T> } = {
  loans: counter(loanCounts, loanKey),
  notificationOutbox: counter(deliveryCounts, deliveryKey),
  reminders: counter(reminderCounts, reminderKey),
  tools: counter(toolCounts, toolKey),
  users: counter(userCounts, userKey),
};
