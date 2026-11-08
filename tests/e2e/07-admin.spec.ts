import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

/** YYYY-MM-DD in the demo org's time zone, n days from today. */
const laDate = (offsetDays: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date(Date.now() + offsetDays * 86_400_000));

test.describe.serial("Admin", () => {
  test("dashboard loads", async ({ page }) => {
    await signIn(page, "admin");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Vehicles ready")).toBeVisible();
  });

  test("people lists employees", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/people");
    await expect(page.getByRole("heading", { name: "Employees" })).toBeVisible();
    for (const name of ["Avery Admin", "Drew Driver", "Toni Technician"]) {
      await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
    }
  });

  test("payroll: creates a period and opens it with lines", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/payroll");
    await expect(page.getByRole("heading", { name: "Payroll periods" })).toBeVisible();
    await page.getByRole("button", { name: "New period" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Period start").fill(laDate(-14));
    await dialog.getByLabel("Period end").fill(laDate(-1));
    await dialog.getByLabel("Pay date").fill(laDate(5));
    await dialog.getByRole("button", { name: "Create period" }).click();
    await expect(page.getByText("Pay period created")).toBeVisible();
    await expect(dialog).toBeHidden();

    await page.getByRole("link", { name: "Open pay period" }).first().click();
    await expect(page).toHaveURL(/\/payroll\/[0-9a-f-]{36}/);
    await expect(page.getByRole("columnheader", { name: "Regular" }).first()).toBeVisible();
    await expect(page.getByText("Riley Park").first()).toBeVisible();
  });

  test("settings: creates a kiosk pairing code", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/settings/kiosks");
    await expect(page.getByText("Time clock kiosks")).toBeVisible();
    await page.getByRole("button", { name: "Pair a new kiosk" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Kiosk name").fill("E2E break room");
    await dialog.getByRole("button", { name: "Create code" }).click();
    await expect(dialog.getByText(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)).toBeVisible();
  });

  test("fleet shows vehicles", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/fleet");
    await expect(page.getByRole("heading", { name: "Vehicles" })).toBeVisible();
    for (const n of ["101", "105", "110"]) {
      await expect(page.getByRole("row").filter({ hasText: n }).first()).toBeVisible();
    }
  });
});
