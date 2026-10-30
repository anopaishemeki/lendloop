import type { LucideIcon } from "lucide-react";
import { LoanCard } from "./loan-card";
import type { LoanView } from "./types";

export function LoanSection({
  title,
  icon: Icon,
  loans,
  empty,
}: {
  title: string;
  icon: LucideIcon;
  loans: LoanView[];
  empty: string;
}) {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2.5 text-xl font-semibold">
        <Icon aria-hidden className="text-terracotta size-5" />
        {title}
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-sans text-xs font-medium">
          {loans.length}
        </span>
      </h2>
      {loans.length === 0 ? (
        <p className="text-muted-foreground rounded-2xl border border-dashed px-5 py-6 text-sm">
          {empty}
        </p>
      ) : (
        <ul className="grid gap-3">
          {loans.map((loan) => (
            <LoanCard key={loan._id} loan={loan} />
          ))}
        </ul>
      )}
    </section>
  );
}
