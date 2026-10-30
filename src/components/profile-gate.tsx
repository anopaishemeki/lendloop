"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../../convex/_generated/api";

/**
 * Renders the signed-in app only once the caller's Convex profile exists, so no
 * query below it can run before `syncCurrentUser` has created the row.
 */
export function ProfileGate({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const sync = useMutation(api.users.syncCurrentUser);
  const [failed, setFailed] = useState(false);

  const runSync = useCallback(() => {
    setFailed(false);
    sync().catch(() => setFailed(true));
  }, [sync]);

  useEffect(() => {
    if (isAuthenticated) runSync();
  }, [isAuthenticated, runSync]);

  if (me) return children;

  if (failed) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center">
        <p className="font-serif text-xl">Something went sideways</p>
        <p className="text-muted-foreground">
          We couldn&apos;t load your profile. Check your connection and try
          again.
        </p>
        <Button onClick={runSync} variant="outline">
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div
      aria-busy="true"
      aria-label="Loading your neighborhood board"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6"
    >
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton className="h-52 rounded-2xl" key={i} />
        ))}
      </div>
    </div>
  );
}
