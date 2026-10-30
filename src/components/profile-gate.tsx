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
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-10">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
