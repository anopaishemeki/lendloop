"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";

/** Creates the caller's Convex profile once Clerk auth reaches Convex. */
export function UserSync() {
  const { isAuthenticated } = useConvexAuth();
  const sync = useMutation(api.users.syncCurrentUser);

  useEffect(() => {
    if (isAuthenticated) {
      sync().catch(() => undefined);
    }
  }, [isAuthenticated, sync]);

  return null;
}
