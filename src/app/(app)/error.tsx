"use client";

import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

export default function AppError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <EmptyState title="That didn't work">
      <p className="text-muted-foreground text-sm">{errorMessage(error)}</p>
      <div className="flex gap-2">
        <Button onClick={reset} variant="outline">
          Try again
        </Button>
        <Button asChild variant="ghost">
          <Link href="/tools">Back to all tools</Link>
        </Button>
      </div>
    </EmptyState>
  );
}
