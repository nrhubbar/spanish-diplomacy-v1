import { expect, test } from "@playwright/test";
import { endTurnAnyway } from "./turn";

// Smoke test against a production build, served the way `npm run personal-prod` serves it.
// Run with: npm run build, serve build/dist, then PROD_URL=http://127.0.0.1:8090/ npx playwright test e2e/production.spec.ts
const productionUrl = process.env["PROD_URL"];

test("the production build plays without test fixtures or console errors", async ({ page, browserName }) => {
  test.skip(productionUrl === undefined || browserName !== "chromium", "Set PROD_URL to a served production build.");
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(productionUrl ?? "");
  await page.getByRole("button", { name: "Create Game" }).click();
  await expect(page.getByRole("heading", { name: "Choose the players" })).toBeVisible();
  await expect(page.getByLabel("Scenario")).toHaveCount(0);
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await expect(page.locator(".map-vector")).toBeVisible();
  await expect(page.locator(".terrain-layer")).toHaveAttribute("data-renderer", "webgl", { timeout: 15000 });
  // Every army, general and aircraft shows its own counter from 125% zoom (Z1): 41 on the ground and five in the air.
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.locator(".unit-counter")).toHaveCount(46);
  await endTurnAnyway(page);
  await expect(page.getByRole("heading", { level: 1, name: "Turn resolution" })).toBeVisible();
  expect(errors).toEqual([]);
});
