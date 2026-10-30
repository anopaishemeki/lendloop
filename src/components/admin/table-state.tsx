import type { usePaginatedQuery } from "convex/react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
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
  children,
}: {
  query: Paginated<T>;
  empty: string;
  children: (rows: T[]) => ReactNode;
}) {
  const { results, status, loadMore } = query;
  if (status === "LoadingFirstPage") return <Skeleton className="h-48" />;
  if (results.length === 0) return <EmptyState title={empty} />;
  return (
    <div className="space-y-3">
      <div className="bg-card overflow-hidden rounded-2xl border shadow-xs">
        <Table>{children(results)}</Table>
      </div>
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button
          disabled={status === "LoadingMore"}
          onClick={() => loadMore(ADMIN_PAGE_SIZE)}
          size="sm"
          variant="outline"
        >
          {status === "LoadingMore" ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
