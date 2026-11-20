import { expect, type Page, test } from "@playwright/test";

// Reviewed visual baselines (Revision 5, section 8.3). Chromium only: other engines raster
// WebGL and fonts differently. Update deliberately with `npm run e2e:baselines` in a commit
// of its own, after reviewing the new images.

test.beforeEach(async ({ browserName, page }) => {
  test.skip(browserName !== "chromium", "Baselines are Chromium-only.");
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
  await page.locator('.map-region[data-territory-id="madrid"]').focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Give Selected Units Order" }).click();
  await page.getByRole("button", { exact: true, name: "Move" }).click();
  await expect(page).toHaveScreenshot("planning-destinations.png");
  for (let step = 0; step < 2; step += 1) await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page).toHaveScreenshot("planning-operational.png");
  for (let step = 0; step < 3; step += 1) await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page).toHaveScreenshot("planning-detail.png");
});

test("resolution", async ({ page }) => {
  await startGame(page);
  await page.getByRole("button", { name: "End Turn" }).filter({ visible: true }).click();
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
