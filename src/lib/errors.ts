import { ConvexError } from "convex/values";

/** User-facing text for a failed Convex call; server messages are already written for people. */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = error.data as { message?: unknown };
    if (typeof data.message === "string") return data.message;
  }
  return "Something went wrong. Please try again.";
}
