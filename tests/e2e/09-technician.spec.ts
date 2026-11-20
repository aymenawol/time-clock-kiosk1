import { expect, test } from "@playwright/test";
import { signIn, signOnPad } from "./helpers";

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

  test("signs a submitted inspection as the technician", async ({ page }) => {
    // Find today's submitted inspection from the office list.
    await signIn(page, "admin");
    await page.goto("/fleet/inspections");
    const link = page.getByRole("link", { name: /\d{1,2}:\d{2}/ }).first();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/fleet\/inspections\/[0-9a-f-]{36}$/);
    const id = href!.split("/").pop()!;
    await page.goto(href!);
    await expect(page.getByRole("heading", { name: "VEHICLE INSPECTION", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Print" })).toBeVisible();
    await expect(page.getByText("NEXT DRIVER REVIEWED THIS DVI:")).toBeVisible();
    await expect(page.getByText(/RAC DVIR/)).toHaveCount(0);

    await signIn(page, "technician");
    await page.goto(`/m/inspections/${id}`);
    await page.getByLabel("Technician's comments").fill("E2E: checked and signed.");
    await signOnPad(page, /Technician signature pad/);
    await page.getByRole("button", { name: "Sign inspection" }).click();
    await expect(page.getByText("Inspection signed")).toBeVisible();
    // Read-only after signing.
    await expect(page.getByText("E2E: checked and signed.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign inspection" })).toHaveCount(0);
  });
});
