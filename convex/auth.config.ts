import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      applicationID: "convex",
      // biome-ignore lint/style/noNonNullAssertion: Convex rejects the push if unset.
      domain: process.env.NEXT_PUBLIC_CLERK_FRONTEND_API_URL!,
    },
  ],
} satisfies AuthConfig;
