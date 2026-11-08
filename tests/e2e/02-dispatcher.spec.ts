import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.describe.serial("Dispatcher", () => {
  test("lands on the board and assigns a vehicle to Drew's shift", async ({ page }) => {
    await signIn(page, "dispatcher");
    await expect(page).toHaveURL(/\/board/);
    await expect(page.getByRole("heading", { name: "Dispatch board" })).toBeVisible();

    await page.getByRole("button", { name: "Edit assignment for Drew Driver" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Assignment: Drew Driver")).toBeVisible();
    const vehicle = dialog.getByLabel("Vehicle");
    const value = await vehicle.locator("option", { hasText: /^101\b/ }).getAttribute("value");
    expect(value).toBeTruthy();
    await vehicle.selectOption(value!);
    await dialog.getByRole("button", { name: "Save assignment" }).click();
    await expect(dialog).toBeHidden();

    const drewRow = page.getByRole("row").filter({ hasText: "Drew Driver" });
    await expect(drewRow.getByText("101", { exact: true })).toBeVisible();
  });

  test("sign-in sheet shows Drew's row", async ({ page }) => {
    await signIn(page, "dispatcher");
    await page.goto("/sign-in-sheet");
    await expect(page.getByRole("heading", { name: "Sign-in sheet" })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: "Drew Driver" });
    await expect(row).toBeVisible();
    await expect(row.getByText("Active")).toBeVisible();
  });

  test("assists page opens", async ({ page }) => {
    await signIn(page, "dispatcher");
    await page.goto("/assists");
    await expect(page.getByRole("heading", { name: "Assist requests" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Active \(/ })).toBeVisible();
  });
});
