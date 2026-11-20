import { expect, test } from "@playwright/test";
import { signIn, signOnPad } from "./helpers";

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
    // The paper form: header, bus diagram, three sections with Pre-Trip and Post-Trip boxes.
    await expect(page.getByRole("heading", { name: "VEHICLE INSPECTION" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "VEHICLE EXTERIOR CHECKS" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "BRAKE SYSTEM CHECKS" })).toBeVisible();
    await expect(page.getByText("Left Side", { exact: true })).toBeVisible();
    await expect(page.getByText("Front End", { exact: true })).toBeVisible();

    // One box cycles blank, OK, X, NA.
    const handrails = page.getByRole("button", { name: /^Handrails, pre-trip/ });
    await handrails.click();
    await expect(handrails).toHaveText("OK");
    await handrails.click();
    await expect(handrails).toHaveText("X");
    await handrails.click();
    await expect(handrails).toHaveText("NA");

    const markRest = page.getByRole("button", { name: "Mark the rest OK" });
    while (await markRest.count()) await markRest.first().click();
    await expect(page.getByText(/of 40 checked/).last()).toBeVisible();

    const review = page.getByLabel(/I have reviewed the previous operator/);
    if (await review.count()) await review.check();
    await page.getByLabel("Beginning Miles").fill("40123");

    // Submitting without a signature is refused.
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page.getByText("Sign the inspection before you submit it.").first()).toBeVisible();
    await signOnPad(page, /Operator signature pad/);
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("All 40 items passed.")).toBeVisible();
    await dialog.getByRole("button", { name: "Submit inspection" }).click();
    await expect(page.getByText("Inspection submitted. All items passed.")).toBeVisible();
  });

  test("post-trip shows the pre-trip marks and only starred items to recheck", async ({ page }) => {
    await signIn(page, "driver");
    await page.goto("/m/inspection/post_trip");
    await expect(page.getByLabel("Beginning Miles")).toHaveValue("40123");
    // Pre-Trip column is read-only; only starred items have a live post-trip box.
    await expect(page.getByRole("button", { name: /pre-trip:/ })).toHaveCount(0);
    const live = page.getByRole("button", { name: /post-trip:/ });
    expect(await live.count()).toBeGreaterThan(0);
    expect(await live.count()).toBeLessThan(40);
    // End miles can't be lower than beginning miles.
    await page.getByLabel("End Miles").fill("40000");
    await expect(page.getByText(/can't be lower than beginning miles/)).toBeVisible();
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
