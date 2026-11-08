import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.describe.serial("Technician", () => {
  test.use({ viewport: { width: 430, height: 932 } });

  test("starts work on a defect and resolves it with a note", async ({ page }) => {
    await signIn(page, "technician");
    await expect(page).toHaveURL(/\/m$/);
    await expect(page.getByRole("heading", { name: /Defect queue/ })).toBeVisible();

    const card = page.getByRole("listitem").filter({ hasText: "Handrails" });
    await expect(card.getByText("Rear handrail loose.")).toBeVisible();
    await card.getByRole("button", { name: "Start work" }).click();
    await expect(page.getByText("Assigned to you")).toBeVisible();
    await expect(card.getByText("In progress")).toBeVisible();

    await card.getByRole("button", { name: "Resolve" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Resolve defect")).toBeVisible();
    await dialog.getByLabel("What did you fix?").fill("Tightened the rear handrail bracket.");
    await dialog.getByRole("button", { name: "Mark resolved" }).click();
    await expect(page.getByText("Defect resolved")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Handrails" })).toHaveCount(0);
  });
});
