import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

const screenshotDir = "build/e2e/screenshots";

async function saveScreenshot(page: Page, name: string): Promise<void> {
  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ fullPage: true, path: `${screenshotDir}/${name}.png` });
}

async function openSetup(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Set Up Campaign" }).click();
}

async function startDefaultGame(page: Page): Promise<void> {
  await openSetup(page);
  await page.getByRole("button", { name: "Start Campaign" }).click();
}

test("configures commanders and keeps online play unavailable", async ({ page }) => {
  await openSetup(page);
  await expect(page.getByRole("heading", { name: "Choose the commanders" })).toBeVisible();
  await expect(page.locator("select").nth(0)).toHaveValue("local-human");
  await expect(page.locator("select").nth(1)).toHaveValue("computer");
  await expect(page.getByRole("option", { name: /Online Player/ }).first()).toBeDisabled();
  await saveScreenshot(page, "milestone-2-faction-setup");
});

test("protects private handoff and resolves a mixed local-computer turn", async ({ page }) => {
  await startDefaultGame(page);
  await expect(page.getByRole("heading", { name: "Pass to Republican Government" })).toBeVisible();
  await expect(page.getByLabel("Iberia campaign map")).not.toBeVisible();
  await saveScreenshot(page, "milestone-2-private-handoff");

  await page.getByRole("button", { name: "Begin Republican Government Orders" }).click();
  const map = page.getByLabel("Iberia campaign map");
  await map.getByRole("button", { name: "Madrid" }).click();
  await page.getByRole("button", { name: /Wad-Ras Infantry Regiment/ }).last().click();
  await page.getByRole("button", { name: "Move selected" }).click();
  await map.getByRole("button", { name: "Castilla-La Mancha" }).click();
  await page.getByRole("button", { name: "Add Move" }).click();
  await expect(page.getByText(/Wad-Ras Infantry Regiment No. 1 → Castilla-La Mancha/)).toBeVisible();
  await saveScreenshot(page, "milestone-2-planned-orders");
  await page.getByRole("button", { name: "Submit Orders" }).click();

  await expect(page.getByRole("heading", { name: "Turn resolution" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Victory progress" })).toBeVisible();
  await saveScreenshot(page, "milestone-2-resolution");
  await page.getByRole("button", { name: "Start Next Turn" }).click();
  await expect(page.getByRole("heading", { name: "Pass to Republican Government" })).toBeVisible();
});

test("hands the device between two local players without revealing orders", async ({ page }) => {
  await openSetup(page);
  await page.locator("select").nth(1).selectOption("local-human");
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await page.getByRole("button", { name: "Begin Republican Government Orders" }).click();
  await page.getByRole("button", { name: "Submit Orders" }).click();
  await expect(page.getByRole("heading", { name: "Pass to Northern Insurgent Command" })).toBeVisible();
  await expect(page.getByText("All formations held")).not.toBeVisible();
  await page.getByRole("button", { name: "Continue to Northern Insurgent Command" }).click();
  await expect(page.getByRole("heading", { name: "Northern Insurgent Command" })).toBeVisible();
  await expect(page.getByText("Republican Government: Ready")).toBeVisible();
});

test("requires an explicit command for an all-computer turn", async ({ page }) => {
  await openSetup(page);
  for (const select of await page.locator("select").all()) await select.selectOption("computer");
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await expect(page.getByRole("button", { name: "Run Computer Turn" })).toBeVisible();
  await page.getByRole("button", { name: "Run Computer Turn" }).click();
  await expect(page.getByRole("heading", { name: "Turn resolution" })).toBeVisible();
});

test("keeps setup and planning usable on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await startDefaultGame(page);
  await page.getByRole("button", { name: "Begin Republican Government Orders" }).click();
  await expect(page.getByLabel("Iberia campaign map")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit Orders" })).toBeVisible();
  await saveScreenshot(page, "milestone-2-mobile-planning");
});

test("guards direct routes before setup", async ({ page }) => {
  for (const path of ["/assets/#/orders", "/assets/#/handoff", "/assets/#/resolution", "/assets/#/game-over"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Choose the commanders" })).toBeVisible();
  }
});
