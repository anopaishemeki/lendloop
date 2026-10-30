import type { FunctionReturnType } from "convex/server";
import { CalendarCheck, Hourglass, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { api } from "../../../convex/_generated/api";
import { LoanSection } from "./loan-section";

type Board = FunctionReturnType<typeof api.loans.listIncoming>;
type SectionCopy = { title: string; empty: string };

const ICONS = { active: CalendarCheck, history: History, pending: Hourglass };

/** Pending, active and closed loans, as grouped by the server. */
export function LoanBoard({
  board,
  copy,
}: {
  board: Board | undefined;
  copy: Record<keyof Board, SectionCopy>;
}) {
  if (board === undefined) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton className="h-32 rounded-2xl" key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {(["pending", "active", "history"] as const).map((key) => (
        <LoanSection
          {...copy[key]}
          icon={ICONS[key]}
          key={key}
          loans={board[key]}
        />
      ))}
    </div>
  );
}
