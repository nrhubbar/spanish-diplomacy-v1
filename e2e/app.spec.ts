import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

const screenshotDir = "build/e2e/screenshots";

async function saveScreenshot(page: Page, name: string): Promise<void> {
  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ fullPage: true, path: `${screenshotDir}/${name}.png` });
}

async function openSetup(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Game" }).click();
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
  await expect(page.getByRole("option", { name: /Remote player/ }).first()).toBeDisabled();
  await saveScreenshot(page, "milestone-2-faction-setup");
});

test("plans directly and resolves a mixed local-computer turn", async ({ page }) => {
  await startDefaultGame(page);
  const map = page.getByLabel("Iberia campaign map");
  const viewport = map.locator(".iberia-map-viewport");
  const counter = map.getByRole("button", { name: /Wad-Ras Infantry Regiment/ });
  await expect(viewport.locator(".campaign-board")).toHaveCount(1);
  await expect(map.locator(":scope > .map-zoom-controls")).toHaveCount(1);
  await expect(map.locator(".iberia-map-terrain")).toHaveAttribute("data-renderer", "webgl");
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
  )).toBe(true);
  const overviewCounterBox = await counter.boundingBox();
  await map.focus();
  await page.keyboard.press("d");
  await expect(viewport).not.toHaveAttribute("data-camera-x", "0");
  await page.keyboard.press("0");
  await page.keyboard.press("+");
  await expect(map).toHaveAttribute("data-semantic-level", "overview");
  await expect(viewport).toHaveAttribute("style", /scale\(1\.35\)/);
  await page.keyboard.press("d");
  await expect(viewport).not.toHaveAttribute("data-camera-x", "0");
  await page.keyboard.press("0");
  await map.evaluate((element) => {
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 220, clientY: 180, pointerId: 1 }));
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 320, clientY: 180, pointerId: 2 }));
    element.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 370, clientY: 180, pointerId: 2 }));
    element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 220, clientY: 180, pointerId: 1 }));
    element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 370, clientY: 180, pointerId: 2 }));
  });
  await expect(viewport).toHaveAttribute("style", /scale\(1\.62\)/);
  await map.getByRole("button", { name: "Reset map view" }).click();
  await page.evaluate(() => window.scrollTo(0, 120));
  await map.hover();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -120);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await expect(map.getByText(/Map zoom/)).not.toHaveText("Map zoom 100 percent");
  await map.getByRole("button", { name: "Reset map view" }).click();
  await counter.click();
  await page.getByRole("button", { name: "Select all available" }).click();
  await page.getByRole("button", { name: "Move selected" }).click();
  await map.getByRole("button", { name: "Castilla-La Mancha" }).click();
  await page.getByRole("button", { name: "Add Move" }).click();
  await expect(page.getByText(/Wad-Ras Infantry Regiment No. 1 → Castilla-La Mancha/)).toBeVisible();
  await expect(page.getByText(/Covadonga Infantry Regiment No. 4 → Castilla-La Mancha/)).toBeVisible();
  await expect(map.getByRole("button", { name: /Wad-Ras Infantry Regiment.*order assigned/ })).toBeDisabled();
  await saveScreenshot(page, "milestone-2-planned-orders");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(map).toHaveAttribute("data-semantic-level", "operational");
  const operationalCounterBox = await counter.boundingBox();
  expect(overviewCounterBox).not.toBeNull();
  expect(operationalCounterBox).not.toBeNull();
  expect(operationalCounterBox!.width).toBeGreaterThan(overviewCounterBox!.width * 1.14);
  expect(operationalCounterBox!.width).toBeLessThan(overviewCounterBox!.width * 1.4);
  await expect(counter.locator(".nato-unit-designation")).toBeVisible();
  await saveScreenshot(page, "milestone-2-map-zoom");
  for (let step = 0; step < 3; step += 1) await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(map).toHaveAttribute("data-semantic-level", "detail");
  const detailCounterBox = await counter.boundingBox();
  expect(detailCounterBox).not.toBeNull();
  expect(detailCounterBox!.width).toBeGreaterThan(operationalCounterBox!.width);
  expect(detailCounterBox!.width).toBeLessThan(overviewCounterBox!.width * 1.9);
  await saveScreenshot(page, "milestone-2-map-detail");
  await page.getByRole("button", { name: "Submit Orders" }).click();

  await expect(page.getByRole("heading", { name: "Turn resolution" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Victory progress" })).toBeVisible();
  await saveScreenshot(page, "milestone-2-resolution");
  await page.getByRole("button", { name: "Start Next Turn" }).click();
  await expect(page.getByRole("heading", { name: "Republican Government" })).toBeVisible();
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
  await page.getByRole("button", { name: "Submit Orders" }).click();
  await expect(page.getByRole("heading", { name: "Turn resolution" })).toBeVisible();
  await page.getByRole("button", { name: "Start Next Turn" }).click();
  await expect(page.getByRole("heading", { name: "Pass to Republican Government" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Begin Republican Government Orders" })).toBeVisible();
});

test("runs an all-computer turn automatically", async ({ page }) => {
  await openSetup(page);
  for (let index = 0; index < 3; index += 1) {
    await page.locator("select").nth(index).selectOption("computer");
    await expect(page.locator("select").nth(index)).toHaveValue("computer");
  }
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await expect(page.getByRole("heading", { name: "Turn resolution" })).toBeVisible();
  await page.getByRole("button", { name: "Start Next Turn" }).click();
  await expect(page.getByRole("heading", { name: "Turn resolution" })).toBeVisible();
  await expect(page.getByText(/Turn 2/)).toBeVisible();
});

test("keeps setup and planning usable on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await startDefaultGame(page);
  await expect(page.getByLabel("Iberia campaign map")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit Orders" })).toBeVisible();
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
  )).toBe(true);
  await saveScreenshot(page, "milestone-2-mobile-planning");
});

test("guards direct routes before setup", async ({ page }) => {
  for (const path of ["/assets/#/orders", "/assets/#/handoff", "/assets/#/resolution", "/assets/#/game-over"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
  }
});
