import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "purge used n8n signatures",
  { hourUTC: 3, minuteUTC: 0 },
  internal.reminders.purgeUsedSignatures,
  {}
);

export default crons;
