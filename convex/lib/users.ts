import type { Doc } from "../_generated/dataModel";

/** Other users only ever see a first name. */
export function firstName(name: string): string {
  return name.split(" ")[0] || name;
}

export function isTrustedLender(user: Doc<"users"> | null): boolean {
  return user?.isTrustedLender ?? false;
}

export function publicProfile(user: Doc<"users"> | null) {
  return {
    firstName: user ? firstName(user.name) : "Neighbor",
    isTrustedLender: isTrustedLender(user),
  };
}
