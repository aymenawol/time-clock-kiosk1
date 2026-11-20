import { expect, type Page } from "@playwright/test";

export const PAIRING_CODE = "E2EKSKAB";
export const DEMO_PASSWORD = "RoleCall-Demo-2026!";

export const LOGINS = {
  admin: "admin@demo.rolecall.app",
  supervisor: "supervisor@demo.rolecall.app",
  dispatcher: "dispatcher@demo.rolecall.app",
  coordinator: "coordinator@demo.rolecall.app",
  driver: "drew@demo.rolecall.app",
  fueler: "fueler@demo.rolecall.app",
  technician: "technician@demo.rolecall.app",
} as const;

export async function signIn(page: Page, role: keyof typeof LOGINS) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(LOGINS[role]);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Type digits on the kiosk keypad. */
export async function keypad(page: Page, digits: string) {
  for (const d of digits) await page.getByRole("group", { name: "Keypad" }).getByRole("button", { name: d, exact: true }).click();
}

/** Draw a short scribble on a signature pad with mouse moves. */
export async function signOnPad(page: Page, name: RegExp | string = /signature pad/i) {
  const pad = page.getByRole("img", { name }).first();
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  if (!box) throw new Error("Signature pad is not visible");
  const at = (fx: number, fy: number) => [box.x + box.width * fx, box.y + box.height * fy] as const;
  await page.mouse.move(...at(0.15, 0.6));
  await page.mouse.down();
  await page.mouse.move(...at(0.3, 0.3), { steps: 6 });
  await page.mouse.move(...at(0.45, 0.65), { steps: 6 });
  await page.mouse.move(...at(0.7, 0.35), { steps: 6 });
  await page.mouse.up();
}
