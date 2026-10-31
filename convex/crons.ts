import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "purge used n8n signatures",
  { hourUTC: 3, minuteUTC: 0 },
  internal.reminders.purgeUsedSignatures,
  {}
);

// One alert email per run at most, covering every failure since the last.
crons.interval(
  "email ops about failed deliveries and reminders",
  { minutes: 5 },
  internal.alerts.sendPendingAlerts,
  {}
);

export default crons;
