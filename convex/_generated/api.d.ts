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
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as lib_availability from "../lib/availability.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_db from "../lib/db.js";
import type * as lib_hmac from "../lib/hmac.js";
import type * as lib_loans from "../lib/loans.js";
import type * as lib_notifications from "../lib/notifications.js";
import type * as lib_roles from "../lib/roles.js";
import type * as lib_text from "../lib/text.js";
import type * as lib_users from "../lib/users.js";
import type * as lib_validators from "../lib/validators.js";
import type * as loans from "../loans.js";
import type * as notifications from "../notifications.js";
import type * as reminders from "../reminders.js";
import type * as tools from "../tools.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  http: typeof http;
  "lib/availability": typeof lib_availability;
  "lib/dates": typeof lib_dates;
  "lib/db": typeof lib_db;
  "lib/hmac": typeof lib_hmac;
  "lib/loans": typeof lib_loans;
  "lib/notifications": typeof lib_notifications;
  "lib/roles": typeof lib_roles;
  "lib/text": typeof lib_text;
  "lib/users": typeof lib_users;
  "lib/validators": typeof lib_validators;
  loans: typeof loans;
  notifications: typeof notifications;
  reminders: typeof reminders;
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
};
