import { expect, type Page, test } from "@playwright/test";
import { chooseMove, endTurnAnyway, selectTerritory } from "./turn";

// Reviewed visual baselines (Revision 5, section 8.3). Chromium on Linux only: other engines
// and operating systems raster WebGL and fonts differently, and CI runs on Linux. Refresh them
// with the "Update visual baselines" workflow (push a baselines/<name> branch), then commit the
// reviewed images in a commit of their own.

test.beforeEach(async ({ browserName, page }) => {
  test.skip(browserName !== "chromium", "Baselines are Chromium-only.");
  test.skip(process.platform !== "linux", "Baselines are Linux renders; CI checks them.");
  // A fixed seed makes computer orders, and therefore resolution screens, deterministic.
  await page.addInitScript(() => { Math.random = () => 0.4242; });
});

async function startGame(page: Page): Promise<void> {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await expect(page.locator(".map-vector")).toBeVisible();
  await expect(page.locator(".terrain-layer")).toHaveAttribute("data-renderer", "webgl", { timeout: 15000 });
  await expect(page.locator(".terrain-layer")).toHaveAttribute("data-refined", "true", { timeout: 15000 });
}

test("setup", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await expect(page).toHaveScreenshot("setup.png");
});

test("planning at every zoom level", async ({ page }) => {
  await startGame(page);
  await expect(page).toHaveScreenshot("planning-overview.png");
  await selectTerritory(page, "madrid");
  await chooseMove(page);
  await expect(page).toHaveScreenshot("planning-destinations.png");
  for (let step = 0; step < 2; step += 1) await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page).toHaveScreenshot("planning-operational.png");
  for (let step = 0; step < 3; step += 1) await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page).toHaveScreenshot("planning-detail.png");
});

test("resolution", async ({ page }) => {
  await startGame(page);
  await endTurnAnyway(page);
  // Start Next Turn appears under the pointer that pressed End Turn; keep hover out of the baseline.
  await page.mouse.move(0, 0);
  await expect(page.locator(".terrain-layer")).toHaveAttribute("data-renderer", "webgl", { timeout: 15000 });
  await expect(page.locator(".terrain-layer")).toHaveAttribute("data-refined", "true", { timeout: 15000 });
  await expect(page).toHaveScreenshot("resolution.png");
});

test("flat-map fallback", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return type.startsWith("webgl") ? null : (original as (...args: unknown[]) => RenderingContext | null).call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await expect(page.locator(".map-vector")).toBeVisible();
  await expect(page.locator(".terrain-fallback")).toBeVisible();
  // The flat images show while WebGL starts; wait for the fallback notice so the frame is settled.
  await expect(page.getByRole("complementary", { name: "Notifications" })).toBeVisible();
  await expect(page).toHaveScreenshot("fallback.png", { mask: [page.locator(".notification-shelf")] });
});
