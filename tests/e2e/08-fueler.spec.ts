import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.describe.serial("Fueler", () => {
  test.use({ viewport: { width: 430, height: 932 } });

  test("home shows the fuel queue and logs a service", async ({ page }) => {
    await signIn(page, "fueler");
    await expect(page).toHaveURL(/\/m$/);
    await expect(page.getByRole("heading", { name: /Fuel and wash queue/ })).toBeVisible();

    const card = page.getByRole("listitem").filter({ hasText: "106" }).filter({ has: page.getByRole("button", { name: "Log service" }) });
    await card.getByRole("button", { name: "Log service" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Log service · 106")).toBeVisible();
    await dialog.getByLabel(/Quantity/).fill("38.5");
    await dialog.getByRole("button", { name: "Save service" }).click();
    await expect(page.getByText(/Logged for vehicle 106/)).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("My services today")).toBeVisible();
    await expect(page.getByText(/fuel · 106/i)).toBeVisible();
  });
});
