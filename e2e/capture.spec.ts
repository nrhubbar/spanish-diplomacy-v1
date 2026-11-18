import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { zoomFullyOn } from "./mapCamera";

// Visual review pass: walks every screen and state and saves full-page captures under
// build/e2e/screenshots. Run with `npm run e2e:capture` while iterating on the UI.

const directory = "build/e2e/screenshots";

async function capture(page: Page, name: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: `${directory}/${test.info().project.name}-${name}.png` });
}

async function waitForMap(page: Page): Promise<void> {
  await expect(page.locator(".map-surface .map-vector")).toBeVisible();
  if (await page.locator(".terrain-layer").count() > 0) {
    await expect(page.locator(".terrain-layer")).toHaveAttribute("data-renderer", "webgl", { timeout: 15000 });
    await expect(page.locator(".terrain-layer")).toHaveAttribute("data-refined", "true", { timeout: 15000 });
  }
}

test("@capture walks every screen", async ({ page }) => {
  await page.goto("./");
  await capture(page, "01-home");
  await page.getByRole("button", { name: "Create Game" }).click();
  await capture(page, "02-setup");
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await waitForMap(page);
  await capture(page, "03-planning-overview");

  await page.locator('.map-region[data-territory-id="madrid"]').focus();
  await page.keyboard.press("Enter");
  await capture(page, "04a-territory-selected");
  await page.getByRole("button", { name: "Give Selected Armies Order" }).click();
  await capture(page, "04b-order-menu");
  await page.getByRole("button", { exact: true, name: "Move" }).click();
  await capture(page, "04-choosing-destination");
  await page.locator('.map-region[data-territory-id="castilla-la-mancha"]').focus();
  await page.keyboard.press("Enter");
  await page.locator('.map-region[data-territory-id="valencia"]').focus();
  await page.keyboard.press("Enter");
  await capture(page, "05-planned-orders");

  for (let step = 0; step < 2; step += 1) await page.getByRole("button", { name: "Zoom in" }).click();
  await capture(page, "06-operational-zoom");
  for (let step = 0; step < 3; step += 1) await page.getByRole("button", { name: "Zoom in" }).click();
  await capture(page, "07-detail-zoom");
  await page.getByRole("button", { name: /reset map view/i }).click();
  const hide = page.getByRole("button", { name: /Hide orders/ });
  if (await hide.isVisible()) await hide.click();
  await capture(page, "08-pane-collapsed");
  await page.getByRole("button", { name: "Orders", exact: true }).click();
  await capture(page, "08b-pane-open");

  await page.getByRole("button", { name: "Submit Orders" }).filter({ visible: true }).click();
  await capture(page, "09-reveal");
  await page.getByRole("button", { name: "Reveal and Resolve" }).click();
  await waitForMap(page);
  await capture(page, "10-resolution");
  await page.locator(".map-legend summary").click();
  await capture(page, "11-resolution-legend");
  const report = page.getByRole("button", { name: "Turn report", exact: true });
  if (await report.isVisible()) {
    await report.click();
    await capture(page, "11b-resolution-report");
  }
});

test("@capture handoff and game over", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByLabel("Scenario").selectOption("tiny-front");
  await expect(page.getByRole("heading", { name: "Blue Union" })).toBeVisible();
  await page.locator("#actor-blue").selectOption("local-human");
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await capture(page, "12-handoff");
  await page.getByRole("button", { name: /Continue to Red League/ }).click();
  await waitForMap(page);
  await capture(page, "13-fixture-planning");
  await page.locator('.map-region[data-territory-id="westfold"]').focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Give Selected Armies Order" }).click();
  await page.getByRole("button", { exact: true, name: "Move" }).click();
  await page.locator('.map-region[data-territory-id="lowlands"]').focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Submit Orders" }).filter({ visible: true }).click();
  await page.getByRole("button", { name: /Continue to Blue Union/ }).click();
  await page.getByRole("button", { name: "Submit Orders" }).filter({ visible: true }).click();
  await page.getByRole("button", { name: "Reveal and Resolve" }).click();
  await waitForMap(page);
  await capture(page, "14-game-over");
});

test.describe("@capture relief close-ups at device pixel ratio 2", () => {
  test.use({ deviceScaleFactor: 2 });

  test("@capture relief close-ups", async ({ browserName, isMobile, page }) => {
    // The quality bar is zoom 4 on a 1440 x 800 desktop at device pixel ratio 2. Four full-zoom
    // walks are heavy in software WebGL, so they run once, in desktop Chromium.
    test.skip(browserName !== "chromium" || isMobile, "Captured once, in desktop Chromium.");
    test.setTimeout(120_000);
    await page.goto("./");
    await page.getByRole("button", { name: "Create Game" }).click();
    await page.getByRole("button", { name: "Start Campaign" }).click();
    await waitForMap(page);
    const hide = page.getByRole("button", { name: /Hide orders/ });
    if (await hide.isVisible()) await hide.click();
    for (const city of ["Valencia", "Barcelona", "Seville", "A Coruna"]) {
      await zoomFullyOn(page, city);
      await page.waitForTimeout(150);
      await capture(page, `15-relief-zoom4-${city.toLowerCase().replace(" ", "-")}`);
    }
  });
});
