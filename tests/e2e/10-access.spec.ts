import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("Access control", () => {
  test("a driver is redirected away from admin pages", async ({ page }) => {
    await signIn(page, "driver");
    for (const path of ["/payroll", "/settings"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/m(\?|$)/);
      await expect(page).not.toHaveURL(new RegExp(path));
    }
  });

  test("an anonymous visitor is sent to the login page", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/board");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});
