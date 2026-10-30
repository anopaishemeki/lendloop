import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table } from "@/components/ui/table";

/** Skeleton while loading, a message when empty, otherwise the table. */
export function TableState<T>({
  rows,
  empty,
  children,
}: {
  rows: T[] | undefined;
  empty: string;
  children: (rows: T[]) => ReactNode;
}) {
  if (rows === undefined) return <Skeleton className="h-48" />;
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">{empty}</p>
    );
  }
  return (
    <div className="bg-card rounded-lg border">
      <Table>{children(rows)}</Table>
    </div>
  );
}
