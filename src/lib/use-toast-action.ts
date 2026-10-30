"use client";

import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "./errors";

/**
 * Runs an async action with a pending flag, a success toast and a readable
 * error toast. Resolves to whether the action succeeded.
 */
export function useToastAction() {
  const [pending, setPending] = useState(false);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setPending(true);
    try {
      await action();
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    } finally {
      setPending(false);
    }
  };

  return { pending, run };
}
