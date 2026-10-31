import aggregate from "@convex-dev/aggregate/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config";
import { defineApp } from "convex/server";
import { COUNTER_COMPONENTS } from "./lib/validators";

const app = defineApp();
// Outbound n8n deliveries run here with retries, off the user's mutation path.
app.use(workpool, { name: "notificationPool" });
// Maintained counters for the admin overview (convex/lib/counters.ts).
for (const name of COUNTER_COMPONENTS) {
  app.use(aggregate, { name });
}

export default app;
