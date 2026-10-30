import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** Other users only ever see a first name. */
export function firstName(name: string): string {
  return name.split(" ")[0] || name;
}

export function publicProfile(user: Doc<"users"> | null) {
  return {
    firstName: user ? firstName(user.name) : "Neighbor",
    isTrustedLender: user?.isTrustedLender ?? false,
  };
}

/** Loads each user at most once per query; seed with documents already in hand. */
export function userLoader(ctx: QueryCtx, ...known: Doc<"users">[]) {
  const cache = new Map<Id<"users">, Promise<Doc<"users"> | null>>(
    known.map((user) => [user._id, Promise.resolve(user)])
  );
  return (id: Id<"users">) => {
    let user = cache.get(id);
    if (!user) {
      user = ctx.db.get(id);
      cache.set(id, user);
    }
    return user;
  };
}
