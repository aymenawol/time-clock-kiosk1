import { expect, test } from "@playwright/test";
import { keypad, PAIRING_CODE } from "./helpers";

test.describe.serial("PIN kiosk", () => {
  test.use({ viewport: { width: 1024, height: 1366 } }); // portrait tablet

  test("pairs to the organization with a one-time code", async ({ page, context }) => {
    await page.goto("/kiosk");
    await expect(page.getByRole("heading", { name: "Pair this kiosk" })).toBeVisible();
    await page.getByLabel("Pairing code").fill(`${PAIRING_CODE.slice(0, 4)}-${PAIRING_CODE.slice(4)}`);
    await page.getByRole("button", { name: "Pair kiosk" }).click();
    await expect(page.getByRole("heading", { name: "Enter your employee number" })).toBeVisible();
    const cookie = (await context.cookies()).find((c) => c.name === "rc_kiosk");
    expect(cookie?.httpOnly).toBe(true);
    await context.storageState({ path: "test-results/kiosk-state.json" });
  });

  test.describe(() => {
    test.use({ storageState: "test-results/kiosk-state.json" });

    test("rejects a wrong PIN with a generic message", async ({ page }) => {
      await page.goto("/kiosk");
      await keypad(page, "2001");
      await page.getByRole("button", { name: "Next" }).click();
      await keypad(page, "1111");
      await page.getByRole("button", { name: "Enter" }).click();
      await expect(page.getByRole("alert")).toContainText("incorrect");
    });

    test("a driver clocks in, takes a rest break and returns", async ({ page }) => {
      const punch = async (action: string, result: RegExp) => {
        await page.goto("/kiosk");
        await keypad(page, "2001");
        await page.getByRole("button", { name: "Next" }).click();
        await keypad(page, "3816");
        await page.getByRole("button", { name: "Enter" }).click();
        await expect(page.getByRole("heading", { name: "Drew Driver" })).toBeVisible();
        await page.getByRole("button", { name: action }).click();
        await expect(page.getByRole("heading", { name: result })).toBeVisible();
      };
      await punch("Clock in", /Clocked in at/);
      await punch("Start rest break", /Rest break started/);
      await punch("End break", /Welcome back/);
    });
  });
});
