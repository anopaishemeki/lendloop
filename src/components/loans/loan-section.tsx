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
      <h2 className="flex items-center gap-2.5 font-semibold text-xl">
        <Icon aria-hidden className="size-5 text-terracotta" />
        {title}
        <span className="rounded-full bg-muted px-2 py-0.5 font-medium font-sans text-muted-foreground text-xs">
          {loans.length}
        </span>
      </h2>
      {loans.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-5 py-6 text-muted-foreground text-sm">
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
