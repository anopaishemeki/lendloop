import aggregate from "@convex-dev/aggregate/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import { defineApp } from "convex/server";
import { COUNTER_COMPONENTS } from "./lib/validators";

const app = defineApp();
// Outbound n8n deliveries run here with retries, off the user's mutation path.
app.use(workpool, { name: "notificationPool" });
// Per-neighbor write limits (convex/lib/limits.ts).
app.use(rateLimiter);
// Maintained counters for the admin overview (convex/lib/counters.ts).
for (const name of COUNTER_COMPONENTS) {
  app.use(aggregate, { name });
}

export default app;
