import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

type ActivityKind = FunctionReturnType<
  typeof api.loans.activity
>[number]["kind"];

/** What each automated email is called, wherever automation is shown. */
export const AUTOMATION_LABELS: Record<ActivityKind, string> = {
  "loan.returned": "Return confirmation",
  "overdue.reminder": "Overdue reminder",
  "request.approved": "Approval email",
  "request.cancelled": "Cancellation email",
  "request.created": "New request email",
  "request.declined": "Decline email",
};
