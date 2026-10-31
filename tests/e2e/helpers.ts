import { clerk } from "@clerk/testing/playwright";
import type { Page } from "@playwright/test";
import { E2E_USERS, type E2EUser } from "./users";

/** Signs in as a test user (one-time Clerk ticket), then opens `path`. */
export async function signInAs(page: Page, user: E2EUser, path: string) {
  await page.goto("/");
  await clerk.signIn({ emailAddress: E2E_USERS[user].email, page });
  await page.goto(path);
}
