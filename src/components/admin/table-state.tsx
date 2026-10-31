import type { usePaginatedQuery } from "convex/react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { LoadMoreButton } from "@/components/load-more";
import { Skeleton } from "@/components/ui/skeleton";
import { Table } from "@/components/ui/table";

export const ADMIN_PAGE_SIZE = 25;

type Paginated<T> = Omit<ReturnType<typeof usePaginatedQuery>, "results"> & {
  results: T[];
};

/** Loading, empty and populated states for a paginated admin table, with "Load more". */
export function TableState<T>({
  query,
  empty,
  showLoadMore = true,
  children,
}: {
  query: Paginated<T>;
  empty: string;
  /** Off for previews that link to the full list instead. */
  showLoadMore?: boolean;
  children: (rows: T[]) => ReactNode;
}) {
  const { results, status } = query;
  if (status === "LoadingFirstPage") return <Skeleton className="h-48" />;
  if (results.length === 0) return <EmptyState title={empty} />;
  return (
    <div className="space-y-3">
      <div className="surface overflow-hidden">
        <Table>{children(results)}</Table>
      </div>
      {showLoadMore ? (
        <LoadMoreButton pageSize={ADMIN_PAGE_SIZE} query={query} />
      ) : null}
    </div>
  );
}
