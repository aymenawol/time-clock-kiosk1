import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("dispatcher acknowledges the driver's assist request", async ({ page }) => {
  await signIn(page, "dispatcher");
  await page.goto("/assists");
  const card = page.getByRole("article", { name: "Assist request for Pat Passenger" });
  await expect(card).toBeVisible();
  await expect(card.getByText("Driver: Drew Driver")).toBeVisible();
  await card.getByRole("button", { name: "Acknowledge" }).click();
  await card.getByLabel("Reply to the driver").fill("Agent meeting you at door 4");
  await card.getByRole("button", { name: "Send" }).click();
  await expect(card.getByText("Acknowledged", { exact: true })).toBeVisible();
  await expect(card.getByText("Agent meeting you at door 4")).toBeVisible();
});
