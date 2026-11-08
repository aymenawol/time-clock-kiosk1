import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.describe.serial("Supervisor", () => {
  test("dashboard loads with tiles", async ({ page }) => {
    await signIn(page, "supervisor");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("On the clock", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Vehicles ready")).toBeVisible();
    await expect(page.getByText("Open alerts").first()).toBeVisible();
  });

  test("returns Drew's time off request with a comment", async ({ page }) => {
    await signIn(page, "supervisor");
    await page.goto("/forms");
    await expect(page.getByRole("heading", { name: "Requests" })).toBeVisible();
    const drew = page.getByRole("row").filter({ hasText: "Drew Driver" });
    await expect(drew.getByText("Time Off Request")).toBeVisible();
    await expect(drew.getByText("Waiting for review")).toBeVisible();
    await drew.getByRole("link", { name: "Drew Driver" }).click();
    await expect(page).toHaveURL(/\/forms\/[0-9a-f-]{36}/);
    await expect(page.getByText("E2E family trip")).toBeVisible();

    await page.getByLabel("Comment").fill("Please pick dates outside the holiday freeze.");
    await page.getByRole("button", { name: "Return for changes" }).click();
    await expect(page.getByText("Decision saved")).toBeVisible();

    await page.goto("/forms");
    await expect(page.getByRole("row").filter({ hasText: "Drew Driver" }).getByText("Returned for changes")).toBeVisible();
  });
});
