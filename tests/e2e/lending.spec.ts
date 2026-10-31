import { expect, type Page, test } from "@playwright/test";
import { addDays, todayUtc } from "../../convex/lib/dates";
import { signInAs } from "./helpers";

/**
 * One listing's life across three people: a lender lists it, a borrower
 * requests and reports it, the lender approves, an admin reviews the report,
 * and the lender removes it (which also cancels the loan). Each run uses a
 * fresh, timestamped name, and the listing is removed at the end.
 */
test.describe.configure({ mode: "serial" });

const PREFIX = "E2E ladder";
const startedAt = Date.now();
const toolName = `${PREFIX} ${startedAt.toString(36)}`;
// Far enough ahead to avoid other loans' dates and "today" edge cases.
const from = addDays(todayUtc(), 60);
const until = addDays(todayUtc(), 61);
// Older leftovers are from failed runs; younger ones may be another live run's.
const STALE_MS = 60 * 60 * 1000;

const MY_LISTINGS = /\/my\/listings$/u;
const TOOLS = /\/tools$/u;

async function choose(page: Page, group: string, option: string) {
  const fieldset = page.getByRole("group", { name: group });
  await fieldset.locator("label").filter({ hasText: option }).click();
  await expect(fieldset.getByRole("radio", { name: option })).toBeChecked();
}

/** Removes a listing from its card, confirming in the dialog. */
async function removeListing(page: Page, name: string) {
  const card = page.locator("article").filter({ hasText: name });
  await card.getByRole("button", { name: "Remove" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove" })
    .click();
  await expect(card).toHaveCount(0);
}

/** Whether a leftover listing is this run's, or stale from a failed one. */
function isOursToClean(name: string) {
  if (name === toolName) return true;
  const created = Number.parseInt(name.slice(PREFIX.length + 1), 36);
  return Number.isFinite(created) && startedAt - created > STALE_MS;
}

const toast = (page: Page, text: string | RegExp) =>
  expect(
    page.locator("[data-sonner-toast]").filter({ hasText: text })
  ).toBeVisible();

// Removes this run's listing, and any a failed run left behind over an hour ago.
test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  await signInAs(page, "lender", "/my/listings");
  // The list streams in over Convex's websocket: wait for cards or the empty state.
  await expect(
    page
      .locator("article")
      .or(page.getByText("You haven't listed anything yet"))
      .first()
  ).toBeVisible();
  const names = await page
    .locator("article")
    .filter({ hasText: PREFIX })
    .getByRole("heading")
    .allTextContents();
  for (const name of names.filter(isOursToClean)) {
    // biome-ignore lint/performance/noAwaitInLoops: each removal re-renders the list, so they go one at a time.
    await removeListing(page, name);
  }
  await page.close();
});

test("a lender lists a tool", async ({ page }) => {
  await signInAs(page, "lender", "/tools/new");
  await page.getByLabel("Name").fill(toolName);
  // The radios are visually hidden behind their labels; click those, as a person would.
  await choose(page, "Category", "Other");
  await choose(page, "Condition", "Good");
  await page.getByLabel("Short description").fill("Created by the e2e tests.");
  await page.getByRole("button", { name: "List tool" }).click();

  await expect(page).toHaveURL(MY_LISTINGS);
  await expect(page.getByRole("heading", { name: toolName })).toBeVisible();
});

test("a borrower requests it", async ({ page }) => {
  await signInAs(page, "borrower", "/tools?category=other");
  const card = page.locator("article").filter({ hasText: toolName });
  await card.getByRole("button", { name: "Request to borrow" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("From").fill(from);
  await dialog.getByLabel("Until").fill(until);
  await dialog.getByRole("button", { name: "Send request" }).click();
  await toast(page, "Request sent");
});

test("the lender approves the request", async ({ page }) => {
  await signInAs(page, "lender", "/my/incoming");
  const loan = page.locator("li").filter({ hasText: toolName });
  await loan.getByRole("button", { name: "Approve" }).click();
  await toast(page, "Request approved");
  await expect(loan.getByText("Approved")).toBeVisible();
});

test("the borrower reports the listing, and can't open the admin portal", async ({
  page,
}) => {
  await signInAs(page, "borrower", "/tools?category=other");
  const card = page.locator("article").filter({ hasText: toolName });
  await card.getByRole("button", { name: `Report ${toolName}` }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Spam" }).click();
  await dialog.getByLabel("Details (optional)").fill("e2e check");
  await dialog.getByRole("button", { name: "Send report" }).click();
  await toast(page, "An admin will take a look");

  // Non-admins are redirected by the proxy, which reads the role from the
  // session token: that needs the Clerk `metadata` session claim.
  await page.goto("/admin");
  await expect(
    page,
    "no redirect: is the Clerk session token missing the metadata claim?"
  ).toHaveURL(TOOLS);
});

test("an admin dismisses the report", async ({ page }) => {
  await signInAs(page, "admin", "/admin/reports");
  const row = page.getByRole("row").filter({ hasText: toolName });
  await expect(row.getByText("Spam")).toBeVisible();
  await row.getByRole("button", { name: "Dismiss" }).click();
  await toast(page, "Report dismissed");
  await expect(row).toHaveCount(0);
});

test("the lender removes the listing", async ({ page }) => {
  await signInAs(page, "lender", "/my/listings");
  await removeListing(page, toolName);
  await toast(page, `${toolName} removed`);
});

test("removing the listing cancelled the borrower's loan", async ({ page }) => {
  await signInAs(page, "borrower", "/my/requests");
  const loan = page.locator("li").filter({ hasText: toolName }).first();
  await expect(loan.getByText("Cancelled")).toBeVisible();
});
