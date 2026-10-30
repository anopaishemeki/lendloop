"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";

const MAX_ATTEMPTS = 5;

/** Creates the caller's Convex profile once Clerk auth reaches Convex, retrying with backoff. */
export function UserSync() {
  const { isAuthenticated } = useConvexAuth();
  const sync = useMutation(api.users.syncCurrentUser);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const attempt = (n: number) => {
      sync().catch((error: unknown) => {
        if (cancelled) return;
        if (n + 1 >= MAX_ATTEMPTS) {
          console.error("Profile sync failed", error);
          return;
        }
        timer = setTimeout(() => attempt(n + 1), 500 * 2 ** n);
      });
    };
    attempt(0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAuthenticated, sync]);

  return null;
}
