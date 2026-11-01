/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as alerts from "../alerts.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as functions from "../functions.js";
import type * as http from "../http.js";
import type * as lib_activity from "../lib/activity.js";
import type * as lib_alerts from "../lib/alerts.js";
import type * as lib_availability from "../lib/availability.js";
import type * as lib_counters from "../lib/counters.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_db from "../lib/db.js";
import type * as lib_env from "../lib/env.js";
import type * as lib_hmac from "../lib/hmac.js";
import type * as lib_limits from "../lib/limits.js";
import type * as lib_listings from "../lib/listings.js";
import type * as lib_loans from "../lib/loans.js";
import type * as lib_notifications from "../lib/notifications.js";
import type * as lib_roles from "../lib/roles.js";
import type * as lib_text from "../lib/text.js";
import type * as lib_tools from "../lib/tools.js";
import type * as lib_users from "../lib/users.js";
import type * as lib_validators from "../lib/validators.js";
import type * as loans from "../loans.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as reminders from "../reminders.js";
import type * as reports from "../reports.js";
import type * as seed from "../seed.js";
import type * as tools from "../tools.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  alerts: typeof alerts;
  auth: typeof auth;
  crons: typeof crons;
  functions: typeof functions;
  http: typeof http;
  "lib/activity": typeof lib_activity;
  "lib/alerts": typeof lib_alerts;
  "lib/availability": typeof lib_availability;
  "lib/counters": typeof lib_counters;
  "lib/dates": typeof lib_dates;
  "lib/db": typeof lib_db;
  "lib/env": typeof lib_env;
  "lib/hmac": typeof lib_hmac;
  "lib/limits": typeof lib_limits;
  "lib/listings": typeof lib_listings;
  "lib/loans": typeof lib_loans;
  "lib/notifications": typeof lib_notifications;
  "lib/roles": typeof lib_roles;
  "lib/text": typeof lib_text;
  "lib/tools": typeof lib_tools;
  "lib/users": typeof lib_users;
  "lib/validators": typeof lib_validators;
  loans: typeof loans;
  migrations: typeof migrations;
  notifications: typeof notifications;
  reminders: typeof reminders;
  reports: typeof reports;
  seed: typeof seed;
  tools: typeof tools;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  notificationPool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"notificationPool">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  loanCounts: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"loanCounts">;
  userCounts: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"userCounts">;
  toolCounts: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"toolCounts">;
  deliveryCounts: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"deliveryCounts">;
  reminderCounts: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"reminderCounts">;
  reportCounts: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"reportCounts">;
};
