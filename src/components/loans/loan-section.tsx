import { LoanCard } from "./loan-card";
import type { LoanView } from "./types";

export function LoanSection({
  title,
  loans,
  empty,
}: {
  title: string;
  loans: LoanView[];
  empty: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
        {title}
        <span className="ml-2 font-normal">{loans.length}</span>
      </h2>
      {loans.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
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
