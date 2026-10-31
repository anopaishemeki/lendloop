import type { usePaginatedQuery } from "convex/react";
import { Button } from "@/components/ui/button";

type Paginated = Pick<
  ReturnType<typeof usePaginatedQuery>,
  "loadMore" | "status"
>;

/** True while a paginated query has (or is fetching) another page. */
export function hasMore(status: Paginated["status"]) {
  return status === "CanLoadMore" || status === "LoadingMore";
}

/** "Load more" under a paginated list; hidden once everything is loaded. */
export function LoadMoreButton({
  query: { loadMore, status },
  pageSize,
  className,
}: {
  query: Paginated;
  pageSize: number;
  /** Placement (e.g. spacing), applied only while the button shows. */
  className?: string;
}) {
  if (!hasMore(status)) return null;
  return (
    <Button
      className={className}
      disabled={status === "LoadingMore"}
      onClick={() => loadMore(pageSize)}
      size="sm"
      variant="outline"
    >
      {status === "LoadingMore" ? "Loading…" : "Load more"}
    </Button>
  );
}
