import type { FunctionReturnType } from "convex/server";
import { Skeleton } from "@/components/ui/skeleton";
import type { api } from "../../../convex/_generated/api";
import { LoanSection } from "./loan-section";

type Board = FunctionReturnType<typeof api.loans.listIncoming>;
type SectionCopy = { title: string; empty: string };

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
          <Skeleton className="h-24" key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <LoanSection {...copy.pending} loans={board.pending} />
      <LoanSection {...copy.active} loans={board.active} />
      <LoanSection {...copy.history} loans={board.history} />
    </div>
  );
}
