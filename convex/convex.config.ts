import workpool from "@convex-dev/workpool/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
// Outbound n8n deliveries run here with retries, off the user's mutation path.
app.use(workpool, { name: "notificationPool" });

export default app;
