"use client";

import { usePaginatedQuery } from "convex/react";
import {
  CalendarCheck,
  History,
  Hourglass,
  type LucideIcon,
} from "lucide-react";
import { hasMore, LoadMoreButton } from "@/components/load-more";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../../../convex/_generated/api";
import type { BoardSection, LoanRole } from "../../../convex/lib/validators";
import { LoanCard } from "./loan-card";

const SECTION_PAGE_SIZE = 10;

// Looked up here: the board renders on the server and can't pass components.
const ICONS: Record<BoardSection, LucideIcon> = {
  active: CalendarCheck,
  history: History,
  pending: Hourglass,
};

function SectionBody({
  loans,
  empty,
}: {
  loans: ReturnType<typeof usePaginatedQuery<typeof api.loans.listBoard>>;
  empty: string;
}) {
  if (loans.status === "LoadingFirstPage") {
    return <Skeleton className="h-32 rounded-2xl" />;
  }
  if (loans.results.length === 0) {
    return (
      <p className="text-muted-foreground rounded-2xl border border-dashed px-5 py-6 text-sm">
        {empty}
      </p>
    );
  }
  return (
    <>
      <ul className="grid gap-3">
        {loans.results.map((loan) => (
          <LoanCard key={loan._id} loan={loan} />
        ))}
      </ul>
      <LoadMoreButton pageSize={SECTION_PAGE_SIZE} query={loans} />
    </>
  );
}

export function LoanSection({
  title,
  empty,
  viewerRole,
  section,
}: {
  title: string;
  empty: string;
  /** Whether the viewer lent ("owner") or borrowed these loans. */
  viewerRole: LoanRole;
  section: BoardSection;
}) {
  const loans = usePaginatedQuery(
    api.loans.listBoard,
    { role: viewerRole, section },
    { initialNumItems: SECTION_PAGE_SIZE }
  );
  const { results, status } = loans;
  const Icon = ICONS[section];
  // Until every page is in, the count is a floor: "10+".
  const more = hasMore(status);

  return (
    <section className="space-y-4">
      <h2 className="font-display flex items-center gap-2.5 text-xl font-semibold">
        <Icon aria-hidden className="text-terracotta size-5" />
        {title}
        {status === "LoadingFirstPage" ? null : (
          <Badge className="font-sans" variant="outline">
            {results.length}
            {more ? "+" : ""}
          </Badge>
        )}
      </h2>
      <SectionBody empty={empty} loans={loans} />
    </section>
  );
}
