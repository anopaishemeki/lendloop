import {
  DAY,
  HOUR,
  MINUTE,
  type RateLimitConfig,
  RateLimiter,
} from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import { fail, type Viewer } from "../auth";

/**
 * Limits on the writes other people see or get emailed about. Token buckets
 * allow a burst, then refill steadily. Take the token after validation: a
 * refused call consumes nothing, and a mutation that fails later rolls its
 * token back. Admins are exempt.
 */
export const LIMITS = {
  // Per borrower: each request emails an owner.
  borrowRequest: { capacity: 10, kind: "token bucket", period: HOUR, rate: 20 },
  // Per reporter.
  listingReport: { capacity: 5, kind: "token bucket", period: DAY, rate: 10 },
  // Per lister.
  newListing: { capacity: 10, kind: "token bucket", period: DAY, rate: 20 },
  // Per owner, across all borrowers, so one inbox can't be flooded.
  ownerRequests: { capacity: 30, kind: "token bucket", period: HOUR, rate: 30 },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitName = keyof typeof LIMITS;

/** Completes "… recently. Try again in N min." */
const REFUSALS: Record<RateLimitName, string> = {
  borrowRequest: "You've sent a lot of borrow requests",
  listingReport: "You've reported a lot of listings",
  newListing: "You've listed a lot of tools",
  ownerRequests: "This lender has had a lot of requests",
};

const rateLimiter = new RateLimiter(components.rateLimiter, LIMITS);

/** Takes one token from `name`'s bucket for `key`, or fails with RATE_LIMITED. */
export async function enforceRateLimit(
  ctx: MutationCtx,
  viewer: Viewer,
  name: RateLimitName,
  key: string = viewer.user._id
) {
  if (viewer.role === "admin") return;
  const { ok, retryAfter } = await rateLimiter.limit(ctx, name, { key });
  if (!ok) {
    const minutes = Math.max(1, Math.ceil(retryAfter / MINUTE));
    fail(
      "RATE_LIMITED",
      `${REFUSALS[name]} recently. Try again in ${minutes} min.`
    );
  }
}
