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
  const hide = page.getByRole("button", { name: /Hide (orders|briefing)/ });
  if (await hide.isVisible()) await hide.click();
  await capture(page, "08-pane-collapsed");
  await page.getByRole("button", { name: "Orders", exact: true }).click();
  await capture(page, "08b-pane-open");

  await page.getByRole("button", { name: "End Turn" }).filter({ visible: true }).click();
  await waitForMap(page);
  await capture(page, "09-resolution");
  await page.locator(".map-legend summary").click();
  await capture(page, "10-resolution-legend");
  const report = page.getByRole("button", { name: "Turn report", exact: true });
  if (await report.isVisible()) {
    await report.click();
    await capture(page, "10b-resolution-report");
  }
});

test("@capture briefing", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await waitForMap(page);
  // Turn 1 opens on the Briefing by itself.
  const briefing = page.getByRole("complementary", { name: "Briefing" });
  await expect(briefing).toBeVisible();
  await capture(page, "16a-briefing-turn-1");
  await briefing.getByRole("heading", { name: "Map controls" }).scrollIntoViewIfNeeded();
  await capture(page, "16b-briefing-scrolled");
  const toggle = page.getByRole("button", { exact: true, name: "Briefing" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("complementary", { name: "Orders" })).toBeAttached();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200); // Let the toggle's colour transition settle.
  await capture(page, "16c-briefing-closed");
});

test("@capture handoff and game over", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByLabel("Scenario").selectOption("tiny-front");
  await expect(page.getByRole("heading", { name: "Blue Union" })).toBeVisible();
  await page.locator("#actor-blue").selectOption("local-human");
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await expect(page.getByRole("heading", { name: "Pass to Red League" })).toBeVisible();
  await capture(page, "11-handoff");
  await page.getByRole("button", { name: /Continue to Red League/ }).click();
  await waitForMap(page);
  await capture(page, "12-fixture-planning");
  await page.locator('.map-region[data-territory-id="westfold"]').focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Give Selected Armies Order" }).click();
  await page.getByRole("button", { exact: true, name: "Move" }).click();
  await page.locator('.map-region[data-territory-id="lowlands"]').focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "End Turn" }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { name: "Pass to Blue Union" })).toBeVisible();
  await expect(page.getByText("Red League has submitted its orders")).toBeVisible();
  await capture(page, "13-handoff-next-player");
  await page.getByRole("button", { name: /Continue to Blue Union/ }).click();
  await waitForMap(page);
  await page.getByRole("button", { name: "End Turn" }).filter({ visible: true }).click();
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
    const hide = page.getByRole("button", { name: /Hide (orders|briefing)/ });
    if (await hide.isVisible()) await hide.click();
    // City labels are Spanish (W2); file names stay ASCII.
    for (const [city, slug] of [["Valencia", "valencia"], ["Barcelona", "barcelona"], ["Sevilla", "sevilla"], ["La Coru\u00f1a", "la-coruna"]] as const) {
      await zoomFullyOn(page, city);
      await page.waitForTimeout(150);
      await capture(page, `15-relief-zoom4-${slug}`);
    }
  });
});

/** Saves the page around the first matching element fully on screen, with a margin for badges. */
async function captureAround(page: Page, selector: string, name: string): Promise<void> {
  const viewport = page.viewportSize();
  const margin = 14;
  for (const element of await page.locator(selector).all()) {
    const box = await element.boundingBox();
    if (viewport === null || box === null || box.x < margin || box.y < margin
      || box.x + box.width + margin > viewport.width || box.y + box.height + margin > viewport.height) continue;
    await mkdir(directory, { recursive: true });
    await page.screenshot({
      clip: { height: box.height + 2 * margin, width: box.width + 2 * margin, x: box.x - margin, y: box.y - margin },
      path: `${directory}/${test.info().project.name}-${name}.png`
    });
    return;
  }
}

/** Counter states that exist in this game; captured only when present on screen. */
const counterStates = [
  ["full", '.unit-counter[data-reduced="false"][data-demoralized="false"]'],
  ["reduced", '.unit-counter[data-reduced="true"][data-demoralized="false"]'],
  ["demoralized", '.unit-counter[data-demoralized="true"]'],
  ["dug-in", ".unit-counter:has(.unit-counter-works)"]
] as const;

test("@capture combat presentation", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await waitForMap(page);
  const hide = page.getByRole("button", { name: /Hide (orders|briefing)/ });
  if (await hide.isVisible()) await hide.click();
  for (const [state, selector] of counterStates) await captureAround(page, selector, `17-counter-overview-${state}`);
  await zoomFullyOn(page, "Madrid");
  await capture(page, "17a-counters-detail");
  for (const [state, selector] of counterStates) await captureAround(page, selector, `17-counter-detail-${state}`);

  // C15: odds on every highlighted destination, on the map and in the Orders pane.
  await page.getByRole("button", { name: /reset map view/i }).click();
  await page.locator('.map-region[data-territory-id="madrid"]').focus();
  await page.keyboard.press("Enter");
  const orders = page.getByRole("button", { name: "Orders", exact: true });
  if (await orders.isVisible()) await orders.click();
  await page.getByRole("button", { name: "Give Selected Armies Order" }).click();
  await page.getByRole("button", { exact: true, name: "Move" }).click();
  await expect(page.locator(".odds-chip").first()).toBeVisible();
  await capture(page, "18-destination-odds");

  // C14: battle cards, when the turn produced any.
  await page.getByRole("button", { name: /^Cancel( move)?$/ }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "End Turn" }).filter({ visible: true }).click();
  await waitForMap(page);
  const report = page.getByRole("button", { name: "Turn report", exact: true });
  if (await report.isVisible()) await report.click();
  const battles = page.locator(".battle-report");
  if (await battles.count() === 0) return;
  await battles.scrollIntoViewIfNeeded();
  await page.locator(".battle-report h3").evaluate((element) => { element.scrollIntoView({ block: "start" }); });
  await capture(page, "19a-battle-cards");
  const threeSided = page.locator('.battle-card[data-sides="3"]').first();
  if (await threeSided.count() > 0) {
    if (await threeSided.getAttribute("open") === null) await threeSided.locator("summary").first().click();
    await threeSided.locator(".battle-rule summary").click();
    await threeSided.evaluate((element) => { element.scrollIntoView({ block: "start" }); });
    await capture(page, "19b-battle-three-sided");
    await threeSided.locator(".battle-rule").evaluate((element) => { element.scrollIntoView({ block: "end" }); });
    await capture(page, "19c-battle-rule");
  }
  await page.locator(".battle-list > li").last().evaluate((element) => { element.scrollIntoView({ block: "end" }); });
  await capture(page, "19d-battle-cards-collapsed");
  await page.locator(".map-legend summary").click();
  await capture(page, "19e-battle-legend");
});

test("@capture reduced counter in the fixture", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByLabel("Scenario").selectOption("tiny-front");
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await waitForMap(page);
  const hide = page.getByRole("button", { name: /Hide (orders|briefing)/ });
  if (await hide.isVisible()) await hide.click();
  await captureAround(page, '.unit-counter[data-unit-id="red-rangers"]', "17b-fixture-reduced-counter");
  await page.locator('.map-region[data-territory-id="highlands"]').focus();
  await page.keyboard.press("Enter");
  const orders = page.getByRole("button", { name: "Orders", exact: true });
  if (await orders.isVisible()) await orders.click();
  await capture(page, "17c-fixture-army-list");
});

test("@capture air missions and generals", async ({ page }) => {
  // U2 (ux-air-a): an aircraft counter at its airfield, its range ring and missions; U5: a general's pill and Sack.
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await waitForMap(page);
  const orders = page.getByRole("button", { name: "Orders", exact: true });
  await page.locator('.map-region[data-territory-id="madrid"]').focus();
  await page.keyboard.press("Enter");
  if (await orders.isVisible()) await orders.click();
  await capture(page, "20a-general-pill");
  await page.locator('.air-counter[data-unit-id="rep-breguet-bombers"]').click();
  if (await orders.isVisible()) await orders.click();
  await page.getByRole("button", { exact: true, name: "Raid" }).click();
  await page.getByRole("combobox").selectOption({ index: 1 });
  await capture(page, "20b-air-raid");
  await page.locator('.air-counter[data-unit-id="rep-ni52-fighters"]').click();
  if (await orders.isVisible()) await orders.click();
  await page.getByRole("button", { exact: true, name: "Intercept" }).click();
  await capture(page, "20c-air-intercept");
  await page.getByRole("button", { name: "End Turn" }).filter({ visible: true }).click();
  await waitForMap(page);
  const report = page.getByRole("button", { name: "Turn report", exact: true });
  if (await report.isVisible()) await report.click();
  const air = page.locator(".outcome-group summary", { hasText: "Air missions" });
  if (await air.count() > 0) await air.first().evaluate((element) => { element.scrollIntoView({ block: "start" }); });
  await capture(page, "20d-air-report");
});
