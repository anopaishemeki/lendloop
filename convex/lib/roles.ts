export type Role = "admin" | "user";

// Clerk's session token carries `"metadata": "{{user.public_metadata}}"`. Both
// src/proxy.ts and Convex read the role through this one function; anything other
// than the exact string "admin" is a regular user.
export function roleFromMetadata(metadata: unknown): Role {
  if (typeof metadata !== "object" || metadata === null) return "user";
  return (metadata as { role?: unknown }).role === "admin" ? "admin" : "user";
}
