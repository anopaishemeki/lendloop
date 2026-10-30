import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      applicationID: "convex",
      domain: process.env.NEXT_PUBLIC_CLERK_FRONTEND_API_URL!,
    },
  ],
} satisfies AuthConfig;
