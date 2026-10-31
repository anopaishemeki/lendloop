"use client";

import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "./errors";

/**
 * Runs an async action with a pending flag, a success toast and a readable
 * error toast. The success message may depend on the action's result.
 * Resolves to whether the action succeeded.
 */
export function useToastAction() {
  const [pending, setPending] = useState(false);

  const run = async <T>(
    action: () => Promise<T>,
    success: string | ((result: T) => string)
  ) => {
    setPending(true);
    try {
      const result = await action();
      toast.success(typeof success === "string" ? success : success(result));
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
