import { expect, test } from "@playwright/test";

const SIGN_IN = /\/sign-in/u;

test("the landing page is public and invites sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Sign in to lend or borrow" })
  ).toBeVisible();
  await expect(page.getByText("Borrow what you need.").first()).toBeVisible();
});

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/tools");
  await expect(page).toHaveURL(SIGN_IN);
});
