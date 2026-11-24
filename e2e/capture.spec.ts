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
  await page.getByRole("button", { name: "Give Selected Units Order" }).click();
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
  await expect(page.locator(".terrain-layer")).toHaveAttribute("data-detail", "shown", { timeout: 15000 });
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
  await page.getByRole("button", { name: "Give Selected Units Order" }).click();
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
  await page.getByRole("button", { name: "Give Selected Units Order" }).click();
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
  // D8: a d20 card shows the die, the modifiers and the score, then its column as bands.
  const graded = page.locator('.battle-card[data-dice="d20"]').first();
  if (await graded.count() > 0) {
    if (await graded.getAttribute("open") === null) await graded.locator("summary").first().click();
    await graded.locator(".battle-bands").first().evaluate((element) => { element.scrollIntoView({ block: "center" }); });
    await capture(page, "19f-d20-battle-card");
  }
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
  await page.locator(".map-legend summary").click();
  // B5, D8 (ux-battle-icon): hovering a battle medallion names its result.
  const icon = page.locator(".battle-icon-button").first();
  if (await icon.count() > 0) {
    await icon.hover();
    await capture(page, "19g-battle-icon-tooltip");
  }
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

test("@capture recruit and replenish", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await waitForMap(page);
  const briefingToggle = page.getByRole("button", { exact: true, name: "Briefing" });
  if (await page.getByRole("complementary", { name: "Briefing" }).isVisible()) await briefingToggle.click();

  await page.locator('.map-region[data-territory-id="catalunya"]').focus();
  await page.keyboard.press("Enter");
  await page.getByRole("tab", { name: "Recruit" }).click();
  await page.getByRole("button", { name: "One more Infantry regiment" }).click();
  await page.getByRole("button", { name: "One more Militia column" }).click();
  await capture(page, "25a-recruit-tab");
  const locked = page.locator('.recruit-row[data-locked="true"]').first();
  await locked.scrollIntoViewIfNeeded();
  await locked.hover();
  await capture(page, "25b-recruit-locked-details");
  await page.getByRole("tab", { name: "Units" }).click();
  await page.locator(".training-list").scrollIntoViewIfNeeded();
  await capture(page, "25c-units-in-training");

  await page.locator('.map-region[data-territory-id="cantabria"]').focus();
  await page.keyboard.press("Enter");
  await page.getByRole("tab", { name: "Recruit" }).click();
  await capture(page, "25d-recruit-tab-provincial");
});

test("@capture replenish (X7, ux-orders-replenish)", async ({ page }) => {
  // Turn 2: a Republican unit that lost men on turn 1, in ground the Republic holds whole.
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await waitForMap(page);
  await page.getByRole("button", { name: "End Turn" }).filter({ visible: true }).click();
  await waitForMap(page);
  await page.getByRole("button", { name: "Start Next Turn" }).filter({ visible: true }).click();
  await waitForMap(page);
  const toggle = page.getByRole("button", { exact: true, name: "Briefing" });
  if (await toggle.isVisible() && await toggle.getAttribute("aria-pressed") === "true") await toggle.click();
  const orders = page.getByRole("button", { name: "Orders", exact: true });
  const territories = await page.locator(".map-region[data-territory-id]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-territory-id") ?? ""));
  for (const territoryId of territories) {
    await page.locator(`.map-region[data-territory-id="${territoryId}"]`).focus();
    await page.keyboard.press("Enter");
    if (await orders.isVisible()) await orders.click();
    const rows = page.locator(".formation-button");
    const texts = await rows.locator(".army-line-strength").allTextContents();
    const index = texts.findIndex((text) => {
      const men = /^(\d+)\/(\d+) men$/u.exec(text.trim());
      return men !== null && Number(men[1]) < Number(men[2]);
    });
    if (index === -1) continue;
    const clear = page.getByRole("button", { name: "Clear" });
    if (await clear.isVisible()) await clear.click();
    await rows.nth(index).click();
    await page.getByRole("button", { name: "Give Selected Units Order" }).click();
    const replenish = page.locator(".order-choice-button", { hasText: "Replenish" });
    if (await replenish.count() > 0 && await replenish.first().isEnabled()) {
      await replenish.first().scrollIntoViewIfNeeded();
      await capture(page, "26-replenish");
      return;
    }
    await page.getByRole("button", { name: "Give Selected Units Order" }).click();
  }
  test.skip(true, "no uncontested Republican unit lost men on turn 1");
});

test("@capture weather and turn timer", async ({ page }) => {
  // The clock is Playwright's, so the countdown is the same on every run.
  await page.clock.install();
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("radio", { name: "5 min" }).check();
  await capture(page, "20a-setup-timer");
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await waitForMap(page);
  const hide = page.getByRole("button", { name: /Hide (orders|briefing)/ });
  const toggle = page.getByRole("button", { exact: true, name: "Briefing" });
  if (await toggle.isVisible() && await toggle.getAttribute("aria-pressed") === "true") await toggle.click();
  await page.locator('.map-region[data-territory-id="catalunya"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("timer")).toBeVisible();
  await capture(page, "20b-planning-timer-weather");
  await page.locator('.map-region[data-territory-id="madrid"]').focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Give Selected Units Order" }).click();
  await page.getByRole("button", { exact: true, name: "Move" }).click();
  await capture(page, "20c-destination-weather");
  await page.getByRole("button", { name: "Pause the turn timer" }).click();
  await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
  await capture(page, "20d-paused");
  await page.getByRole("button", { name: "Resume" }).click();
  await page.clock.fastForward("09:52");
  await expect(page.getByRole("timer")).toHaveAttribute("aria-label", /0:0\d/);
  await capture(page, "20e-ten-seconds");
  await page.clock.fastForward("00:15");
  await waitForMap(page);
  const report = page.getByRole("button", { name: "Turn report", exact: true });
  if (await report.isVisible()) await report.click();
  await page.getByRole("heading", { name: "Conditions" }).scrollIntoViewIfNeeded();
  await capture(page, "20f-time-ran-out");
  if (await hide.isVisible()) await hide.click();
});

test("@capture economy: resource chips, Build tab and the focused build list", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await waitForMap(page);
  const briefingToggle = page.getByRole("button", { exact: true, name: "Briefing" });
  if (await page.getByRole("complementary", { name: "Briefing" }).isVisible()) await briefingToggle.click();
  await page.locator('.map-region[data-territory-id="catalunya"]').focus();
  await page.keyboard.press("Enter");
  const orders = page.getByRole("button", { name: "Orders", exact: true });
  if (await orders.isVisible()) await orders.click();
  await page.getByRole("tab", { name: "Build" }).click();
  await capture(page, "21a-build-tab");
  await page.getByRole("button", { name: "Build in Barcelona" }).click();
  await capture(page, "21b-build-focus");
  await page.getByRole("button", { name: /^Queue / }).first().click();
  await page.locator(".site-queue").first().evaluate((element) => { element.scrollIntoView({ block: "center" }); });
  await capture(page, "21c-build-queued");
  await page.locator(".resource-chip").first().click();
  await capture(page, "21d-resource-detail");
});

test("@capture sub-territories and contested ground", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await waitForMap(page);
  await page.locator('.map-region[data-territory-id="andalucia"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".sub-territory-wash")).toBeAttached();
  await capture(page, "22a-contested-overview");
  await page.getByRole("button", { name: "Give Selected Units Order" }).click();
  await capture(page, "22b-contested-orders");
  await page.getByRole("button", { exact: true, name: "Withdraw" }).click();
  await capture(page, "22c-withdraw-destination");
  await page.getByRole("button", { name: /Cancel withdrawal|Cancel/ }).first().click();
  for (let step = 0; step < 3; step += 1) await page.getByRole("button", { name: "Zoom in" }).click();
  await capture(page, "22d-contested-zoom");
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
  await page.locator(".general-pill").first().evaluate((element) => { element.scrollIntoView({ block: "center" }); });
  await capture(page, "24a-general-pill");
  await page.locator('.air-counter[data-unit-id="rep-breguet-bombers"]').click();
  if (await orders.isVisible()) await orders.click();
  await page.getByRole("button", { exact: true, name: "Raid" }).click();
  await page.getByRole("combobox").selectOption({ index: 1 });
  await page.waitForTimeout(300); // the mission buttons fade between states
  await capture(page, "24b-air-raid");
  await page.locator('.air-counter[data-unit-id="rep-ni52-fighters"]').click();
  if (await orders.isVisible()) await orders.click();
  await page.getByRole("button", { exact: true, name: "Intercept" }).click();
  await page.waitForTimeout(300); // the mission buttons fade between states
  await capture(page, "24c-air-intercept");
  await page.getByRole("button", { name: "End Turn" }).filter({ visible: true }).click();
  await waitForMap(page);
  const report = page.getByRole("button", { name: "Turn report", exact: true });
  if (await report.isVisible()) await report.click();
  const air = page.locator(".outcome-group summary", { hasText: "Air missions" });
  if (await air.count() > 0) await air.first().evaluate((element) => { element.scrollIntoView({ block: "start" }); });
  await capture(page, "24d-air-report");
});

test("@capture movement, rail and ports (X5, X6)", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await waitForMap(page);
  const toggle = page.getByRole("button", { exact: true, name: "Briefing" });
  if (await toggle.isVisible() && await toggle.getAttribute("aria-pressed") === "true") await toggle.click();
  await page.locator('.map-region[data-territory-id="madrid"]').focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Give Selected Units Order" }).click();
  await page.getByRole("button", { exact: true, name: "Move" }).click();
  await expect(page.locator(".army-leaving").first()).toBeAttached();
  await capture(page, "23a-move-destinations");
  const railRow = page.locator(".destination-row").filter({ hasText: /By rail|Rail, then/ }).first();
  if (await railRow.isVisible()) {
    await railRow.scrollIntoViewIfNeeded();
    await railRow.hover();
    await capture(page, "23b-move-route-card");
  }
  await page.getByRole("button", { name: /^Cancel( move)?$/ }).filter({ visible: true }).first().click();
  for (let step = 0; step < 2; step += 1) await page.getByRole("button", { name: "Zoom in" }).click();
  await capture(page, "23c-rail-operational");
});
