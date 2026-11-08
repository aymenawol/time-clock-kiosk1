import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

export const PASSENGER = "Pat Passenger";
export const TIME_OFF_COMMENT = "E2E family trip";

const isoPlusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

test.describe.serial("Driver on a phone", () => {
  test.use({ viewport: { width: 430, height: 932 } });

  test("home shows the shift card with the assigned vehicle", async ({ page }) => {
    await signIn(page, "driver");
    await expect(page).toHaveURL(/\/m$/);
    await expect(page.getByText("On the clock")).toBeVisible();
    await expect(page.getByText("Vehicle", { exact: true })).toBeVisible();
    await expect(page.getByText("101", { exact: true })).toBeVisible();
  });

  test("sends radio code 10-8", async ({ page }) => {
    await signIn(page, "driver");
    await page.getByRole("button", { name: "10-8 In Service" }).click();
    await expect(page.getByText("Sent 10-8 In Service")).toBeVisible();
    await expect(page.getByRole("button", { name: "10-8 In Service" })).toHaveAttribute("aria-pressed", "true");
  });

  test("submits the pre-trip inspection", async ({ page }) => {
    await signIn(page, "driver");
    await page.goto("/m/inspection/pre_trip");
    const passRest = page.getByRole("button", { name: "Pass the rest" });
    while (await passRest.count()) await passRest.first().click();
    await expect(page.getByText(/^38 of 38 checked$|of 38 checked/).last()).toBeVisible();
    await page.getByLabel("Beginning mileage").fill("40123");
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("All 38 items passed.")).toBeVisible();
    await dialog.getByRole("button", { name: "Submit inspection" }).click();
    await expect(page.getByText("Inspection submitted. All items passed.")).toBeVisible();
  });

  test("submits an assist request", async ({ page }) => {
    await signIn(page, "driver");
    await page.goto("/m/assist");
    await page.getByLabel("Passenger name").fill(PASSENGER);
    await page.getByLabel("Airline").click();
    await page.getByRole("option", { name: /Southwest Airlines/ }).click();
    await page.getByLabel("Flight number").fill("WN 1234");
    await page.getByRole("button", { name: "Submit 10-51 request" }).click();
    await expect(page.getByText("Request sent to dispatch")).toBeVisible();
    await expect(page.getByText(PASSENGER).first()).toBeVisible();
  });

  test("submits a time off request", async ({ page }) => {
    await signIn(page, "driver");
    await page.goto("/m/forms/new");
    await page.getByRole("link", { name: /Time Off Request/ }).click();
    await page.getByLabel("Start Date").fill(isoPlusDays(30));
    await page.getByLabel("End Date").fill(isoPlusDays(31));
    await page.getByLabel("Type").selectOption("vacation");
    await page.getByLabel("Comments").fill(TIME_OFF_COMMENT);
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page).toHaveURL(/\/m\/forms\/[0-9a-f-]{36}/);
    await expect(page.getByText("Waiting for review").first()).toBeVisible();
  });
});
