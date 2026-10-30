import { Skeleton } from "@/components/ui/skeleton";
import { LoanSection } from "./loan-section";
import type { LoanView } from "./types";

type SectionCopy = { title: string; empty: string };

/** Splits loans into pending, active (approved) and closed sections. */
export function LoanBoard({
  loans,
  pending,
  active,
  history,
}: {
  loans: LoanView[] | undefined;
  pending: SectionCopy;
  active: SectionCopy;
  history: SectionCopy;
}) {
  if (loans === undefined) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton className="h-24" key={i} />
        ))}
      </div>
    );
  }

  const byStatus = (match: (loan: LoanView) => boolean) => loans.filter(match);

  return (
    <div className="space-y-8">
      <LoanSection
        {...pending}
        loans={byStatus((loan) => loan.status === "requested")}
      />
      <LoanSection
        {...active}
        loans={byStatus((loan) => loan.status === "approved")}
      />
      <LoanSection
        {...history}
        loans={byStatus(
          (loan) => loan.status !== "requested" && loan.status !== "approved"
        )}
      />
    </div>
  );
}
