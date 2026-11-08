import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("coordinator records a compliance verdict on a shift", async ({ page }) => {
  await signIn(page, "coordinator");
  await page.goto("/compliance");
  await expect(page.getByRole("heading", { name: "Breaks and compliance" })).toBeVisible();
  const drew = page.getByRole("row").filter({ hasText: "Drew Driver" });
  await drew.getByRole("button", { name: "Review" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Compliance: Drew Driver")).toBeVisible();
  await dialog.getByRole("radio", { name: "OK" }).click();
  await dialog.getByLabel("Note").fill("Breaks taken in window.");
  await dialog.getByRole("button", { name: "Save verdict" }).click();
  await expect(dialog).toBeHidden();
  await expect(drew.getByText("OK", { exact: true })).toBeVisible();
  await expect(drew.getByText("Breaks taken in window.")).toBeVisible();
});
