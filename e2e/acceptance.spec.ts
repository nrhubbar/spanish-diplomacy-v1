import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import sharp from "sharp";
import { zoomFullyOn } from "./mapCamera";

// User-story acceptance tests (Revision 5, section 8.2). They assert what a player sees and
// never inspect Redux state.

async function openSetup(page: Page): Promise<void> {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await expect(page.getByRole("heading", { name: "Choose the players" })).toBeVisible();
}

async function mapReady(page: Page): Promise<void> {
  await expect(page.locator(".map-vector")).toBeVisible();
}

async function selectTerritory(page: Page, territoryId: string): Promise<void> {
  await page.locator(`.map-region[data-territory-id="${territoryId}"]`).focus();
  await page.keyboard.press("Enter");
}

async function pane(page: Page, name: string) {
  const toggle = page.getByRole("button", { exact: true, name });
  if (await toggle.isVisible()) await toggle.click();
  return page.getByRole("complementary", { name });
}

/** Gives the selected armies a Move order from the Orders pane and waits for destination choice. */
async function orderMove(page: Page): Promise<void> {
  const orders = await pane(page, "Orders");
  await orders.getByRole("button", { name: "Give Selected Armies Order" }).click();
  await orders.getByRole("button", { exact: true, name: "Move" }).click();
  await expect(page.locator('[data-highlight="destination"]').first()).toBeAttached();
}

/**
 * Selects an army from its map counter. On a phone's compact overview one counter stands for
 * all of a faction's armies in a territory; activating it selects the territory, and with it
 * every army there, which then show one by one.
 */
async function activateArmy(page: Page, army: RegExp, territory: string, how: "click" | "keyboard" = "click"): Promise<void> {
  const counters = page.locator(".counter-layer");
  const group = counters.getByRole("button", { name: new RegExp(`armies in ${territory}`) });
  const target = await group.count() > 0 ? group.first() : counters.getByRole("button", { name: army }).first();
  if (how === "click") {
    await target.click();
  } else {
    await target.focus();
    await page.keyboard.press("Enter");
  }
}

async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(serious.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
}

test("plays a mixed local and computer turn straight through to the results", async ({ page }) => {
  await openSetup(page);
  await expectAccessible(page);
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await mapReady(page);
  await expect(page.getByText(/Turn 1 . Late July 1936/)).toBeVisible();
  await expectAccessible(page);
  await selectTerritory(page, "madrid");
  const orders = await pane(page, "Orders");
  await expect(orders.getByText("4 of 4 selected")).toBeVisible();
  await orders.getByRole("button", { name: "Give Selected Armies Order" }).click();
  await expectAccessible(page);
  await orders.getByRole("button", { exact: true, name: "Move" }).click();
  await expectAccessible(page);
  await selectTerritory(page, "castilla-la-mancha");
  await pane(page, "Orders");
  await expect(orders.getByRole("list", { name: "Planned moves (4)" })).toBeVisible();
  await page.getByRole("button", { name: "End Turn" }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Turn resolution" })).toBeVisible();
  await mapReady(page);
  const report = await pane(page, "Turn report");
  await expect(report.getByRole("heading", { name: "What happened" })).toBeVisible();
  await expectAccessible(page);
  // Spain fights standing battles every turn (M27), so the first report always has battle cards
  // with a rule explanation. Open every card and explanation and check the real report again.
  await expect(report.locator("details.battle-card").first()).toBeVisible();
  await expect(report.locator("details.battle-rule").first()).toBeAttached();
  await report.locator("details.battle-card, details.battle-rule").evaluateAll((elements) => {
    for (const element of elements) if (element instanceof HTMLDetailsElement) element.open = true;
  });
  await expect(report.locator("details.battle-rule").first()).toHaveAttribute("open", "");
  await expectAccessible(page);
  await page.getByRole("button", { name: "Start Next Turn" }).filter({ visible: true }).click();
  await mapReady(page);
  await expect(page.getByText(/^Turn 2/)).toBeVisible();
});

/** A2: an odds "i" opens and closes its one sentence by click and by keyboard, and stays accessible open. */
async function exerciseOddsInfo(page: Page, scope: Locator, name: string): Promise<void> {
  const info = scope.getByRole("button", { name });
  // The note the button controls: a phone's hidden pane body holds a second copy of the text.
  const note = page.locator(`[id="${await info.getAttribute("aria-controls") ?? ""}"]`);
  await expect(note).toHaveText(/real odds may differ/);
  await expect(note).toBeHidden();
  await info.click();
  await expect(info).toHaveAttribute("aria-expanded", "true");
  await expect(note).toBeVisible();
  await expectAccessible(page);
  await info.click();
  await expect(note).toBeHidden();
  await info.focus();
  await page.keyboard.press("Enter");
  await expect(note).toBeVisible();
  await page.keyboard.press("Space");
  await expect(info).toHaveAttribute("aria-expanded", "false");
  await expect(note).toBeHidden();
}

test("marks the odds approximate and explains them behind the i (A1, A2)", async ({ isMobile, page }) => {
  await openSetup(page);
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await mapReady(page);
  await selectTerritory(page, "madrid");
  await orderMove(page);
  // Madrid's armies would meet the Northern command in Castilla y Le\u00f3n.
  await expect(page.locator('.odds-layer .odds-chip[data-territory-id="castilla-y-leon"]')).toHaveText(/^\u2248 \d+:\d+ \u00b7 \d+%$/);
  // A phone's sheet stays collapsed while a destination is chosen, so the list shows on wider
  // screens and a phone reaches the same "i" in the sheet's bar.
  const choosing = page.getByRole("complementary", { name: "Orders" });
  if (!isMobile) {
    await expect(choosing.getByRole("button", { name: /Castilla y Le\u00f3n.*Approximately \d+:\d+, \d+ percent to take it/ })).toBeVisible();
  }
  await exerciseOddsInfo(page, choosing, "About the destination odds");
  await selectTerritory(page, "castilla-y-leon");
  const orders = await pane(page, "Orders");
  await expect(orders.locator(".planned-odds").first()).toHaveText(/^Approx\. \d+:\d+ \u00b7 \d+%/);
  await exerciseOddsInfo(page, orders, "About the planned odds");
});

test("opens the Briefing on turn 1, toggles it with the i control, and stays accessible (B1, B4)", async ({ page }) => {
  await openSetup(page);
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await mapReady(page);
  const briefing = page.getByRole("complementary", { name: "Briefing" });
  await expect(briefing.getByRole("heading", { name: "Objective" })).toBeVisible();
  await expect(briefing.getByRole("heading", { name: "Intelligence report" })).toBeVisible();
  await expect(briefing.getByRole("meter", { name: /^Territories: \d+ held, 10 of 18 needed$/ })).toBeAttached();
  await expectAccessible(page);
  const toggle = page.getByRole("button", { exact: true, name: "Briefing" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("complementary", { name: "Orders" })).toBeAttached();
  await toggle.click();
  await expect(briefing).toBeVisible();
  await selectTerritory(page, "madrid");
  await expect((await pane(page, "Orders")).getByRole("heading", { name: "Madrid" })).toBeVisible();
});

test("passes the device privately between three local players", async ({ page }) => {
  await openSetup(page);
  await page.locator("#actor-north").selectOption("local-human");
  await page.locator("#actor-south").selectOption("local-human");
  await page.getByRole("button", { name: "Start Campaign" }).click();
  for (const [name, next] of [["Republican Government", "Northern Insurgent Command"], ["Northern Insurgent Command", "Southern Insurgent Command"]] as const) {
    await expect(page.getByRole("heading", { name: `Pass to ${name}` })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: `Continue to ${name}` }).click();
    await mapReady(page);
    await page.getByRole("button", { name: "End Turn" }).filter({ visible: true }).click();
    await expect(page.getByRole("heading", { name: `Pass to ${next}` })).toBeVisible();
    await expect(page.getByText(`${name} has submitted its orders`)).toBeVisible();
  }
  await page.getByRole("button", { name: "Continue to Southern Insurgent Command" }).click();
  await page.getByRole("button", { name: "End Turn" }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Turn resolution" })).toBeVisible();
});

test("gives two colocated armies different destinations", async ({ page }) => {
  await openSetup(page);
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await mapReady(page);
  const covadongaCounter = page.locator(".counter-layer").getByRole("button", { name: /Covadonga Infantry Regiment No. 4/ });
  await activateArmy(page, /Wad-Ras Infantry Regiment No. 1/, "Madrid");
  await expect(covadongaCounter).toHaveAttribute("aria-pressed", "true");
  const armies = (await pane(page, "Orders")).getByRole("list", { name: "Your armies" });
  await armies.getByRole("button", { name: /Covadonga/ }).click();
  await expect(covadongaCounter).toHaveAttribute("aria-pressed", "false");
  await orderMove(page);
  await selectTerritory(page, "castilla-la-mancha");
  await expect(covadongaCounter).toHaveAttribute("aria-pressed", "true");
  await orderMove(page);
  await selectTerritory(page, "castilla-y-leon");
  const orders = await pane(page, "Orders");
  await expect(orders.getByText(/Madrid . Castilla-La Mancha/).first()).toBeVisible();
  await expect(orders.getByText(/Madrid . Castilla y Le\u00f3n/)).toBeVisible();
});

test("ends the fixture scenario in victory and blocks the next turn", async ({ page }) => {
  await openSetup(page);
  await page.getByLabel("Scenario").selectOption("tiny-front");
  await expect(page.getByRole("heading", { name: "Blue Union" })).toBeVisible();
  // A second local player who holds keeps the outcome independent of computer play and dice.
  await page.locator("#actor-blue").selectOption("local-human");
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await page.getByRole("button", { name: "Continue to Red League" }).click();
  await mapReady(page);
  await selectTerritory(page, "westfold");
  await orderMove(page);
  await selectTerritory(page, "lowlands");
  await page.getByRole("button", { name: "End Turn" }).filter({ visible: true }).click();
  await page.getByRole("button", { name: "Continue to Blue Union" }).click();
  await mapReady(page);
  await page.getByRole("button", { name: "End Turn" }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Red League wins" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Next Turn" })).toHaveCount(0);
  await expectAccessible(page);
  await page.getByRole("button", { name: "Set Up Another Campaign" }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { name: "Choose the players" })).toBeVisible();
});

test("plays a turn with the keyboard alone (B3)", async ({ page }) => {
  await openSetup(page);
  await page.getByRole("button", { name: "Start Campaign" }).focus();
  await page.keyboard.press("Enter");
  await mapReady(page);
  const counter = page.getByRole("button", { name: /Wad-Ras Infantry Regiment No. 1/ }).first();
  await activateArmy(page, /Wad-Ras Infantry Regiment No. 1/, "Madrid", "keyboard");
  await expect(counter).toHaveAttribute("aria-pressed", "true");
  const orders = await pane(page, "Orders");
  await orders.getByRole("button", { name: "Give Selected Armies Order" }).focus();
  await page.keyboard.press("Enter");
  await orders.getByRole("button", { exact: true, name: "Move" }).focus();
  await page.keyboard.press("Enter");
  // Focus lands on the visible Cancel control instead of being lost with the Move button.
  await expect(page.locator(":focus")).toHaveText(/^Cancel/);
  await selectTerritory(page, "castilla-la-mancha");
  await expect((await pane(page, "Orders")).getByRole("list", { name: "Planned moves (4)" })).toBeVisible();
  await page.getByRole("button", { name: "Zoom in" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Map zoom 125 percent")).toBeAttached();
  await page.getByRole("button", { name: "End Turn" }).filter({ visible: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Turn resolution" })).toBeVisible();
});

test("moves the Army of Africa across the Strait (B1, OD-7)", async ({ page }) => {
  await openSetup(page);
  await page.locator("#actor-republic").selectOption("computer");
  await page.locator("#actor-south").selectOption("local-human");
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await mapReady(page);
  // On a phone the turn-1 Briefing sheet covers Ceuta; close it first.
  const hideBriefing = page.getByRole("button", { name: "Hide briefing" });
  if (await hideBriefing.isVisible()) await hideBriefing.click();
  await activateArmy(page, /Tercio Legion No\. 2 \(Banderas IV-VI\)/, "Ceuta");
  await orderMove(page);
  await expect(page.locator('[data-highlight="destination"][data-territory-highlight="andalucia"]')).toBeAttached();
  await selectTerritory(page, "andalucia");
  await expect((await pane(page, "Orders")).getByText(/Ceuta . Andaluc\u00eda/).first()).toBeVisible();
  await page.getByRole("button", { name: "End Turn" }).filter({ visible: true }).click();
  const report = await pane(page, "Turn report");
  await expect(report.getByText(/Southern Insurgent Command: Tercio Legion No\. 2 \(Banderas IV-VI\).* (moved|tried to move)( together)? from Ceuta to Andaluc\u00eda/).first()).toBeAttached();
  await expect(report.getByText(/impossible order/)).toHaveCount(0);
});

test("shimmers legal destinations in gold, and holds still for reduced motion", async ({ page }) => {
  await openSetup(page);
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await mapReady(page);
  await selectTerritory(page, "madrid");
  await orderMove(page);
  const glint = page.locator('[data-highlight="destination"] .map-highlight-glint').first();
  await expect(glint).toHaveCSS("animation-name", "destination-glint-core");
  await expect(page.locator('[data-highlight="origin"] .map-highlight-glint')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(glint).toHaveCSS("animation-name", "none");
  await page.getByRole("button", { name: /^Cancel/ }).filter({ visible: true }).click();
  await expect(page.locator('[data-highlight="destination"]')).toHaveCount(0);
});

test("pans and zooms without scrolling the page", async ({ page, isMobile }) => {
  test.skip(isMobile, "Mouse wheel and drag are desktop inputs; touch is covered separately.");
  await openSetup(page);
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await mapReady(page);
  const map = page.getByRole("application", { name: /map/ });
  const box = await map.boundingBox();
  if (box === null) throw new Error("map has no box");
  await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -400);
  await expect.poll(() => map.getAttribute("data-zoom")).not.toBe("1.00");
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  const before = await map.getAttribute("data-camera-x");
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 3 + 120, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(map).not.toHaveAttribute("data-camera-x", before ?? "");
  await expect(page.getByRole("heading", { name: "Madrid" })).toHaveCount(0);
});

test("pinches to zoom with real touch events", async ({ page, browserName, isMobile }) => {
  test.skip(browserName !== "chromium" || !isMobile, "CDP touch emulation is Chromium-only.");
  await openSetup(page);
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await mapReady(page);
  const map = page.getByRole("application", { name: /map/ });
  const box = await map.boundingBox();
  if (box === null) throw new Error("map has no box");
  const cdp = await page.context().newCDPSession(page);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 3;
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", spread: number) => cdp.send("Input.dispatchTouchEvent", {
    touchPoints: type === "touchEnd" ? [] : [{ id: 1, x: cx - spread, y: cy }, { id: 2, x: cx + spread, y: cy }],
    type
  });
  await touch("touchStart", 30);
  for (const spread of [45, 60, 80, 100]) await touch("touchMove", spread);
  await touch("touchEnd", 0);
  await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBeGreaterThan(1.5);
});

test("falls back to the flat map when WebGL is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return type.startsWith("webgl") ? null : (original as (...args: unknown[]) => RenderingContext | null).call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await openSetup(page);
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await mapReady(page);
  await expect(page.getByText(/WebGL is unavailable|flat map/)).toBeVisible();
  await expect(page.locator(".terrain-layer")).toHaveAttribute("data-renderer", "image-fallback");
  await expect(page.locator(".terrain-fallback")).toBeVisible();
});

test("falls back to the flat map when the WebGL context is lost", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "WEBGL_lose_context is exercised in Chromium.");
  await openSetup(page);
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await expect(page.locator(".terrain-layer")).toHaveAttribute("data-renderer", "webgl", { timeout: 15000 });
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas.terrain-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("no terrain canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  });
  await expect(page.locator(".terrain-layer")).toHaveAttribute("data-renderer", "image-fallback");
  await expect(page.getByText(/showing the flat map/)).toBeVisible();
});

test("draws the relief coastline exactly under the region coastline at full zoom", async ({ page }) => {
  await openSetup(page);
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await expect(page.locator(".terrain-layer")).toHaveAttribute("data-refined", "true", { timeout: 15000 });
  const hide = page.getByRole("button", { name: /Hide (orders|briefing)/ });
  if (await hide.isVisible()) await hide.click();
  await zoomFullyOn(page, "Valencia");
  // Leave only the relief visible; the vector layer keeps its geometry for the measurements.
  await page.addStyleTag({ content: ".map-vector, .counter-layer, .map-pane, .map-legend, .map-controls { visibility: hidden !important; }" });
  await page.waitForTimeout(200);

  // Points 1.2 km either side of the bound regions' coastline, in screen pixels. A misregistration
  // of a texel or two would leave land color on the sea side or sea color on the land side.
  const pairs = await page.evaluate(() => {
    const svg = document.querySelector("svg.map-vector");
    const surface = document.querySelector(".map-surface")?.getBoundingClientRect();
    if (!(svg instanceof SVGSVGElement) || surface === undefined) throw new Error("no map");
    const matrix = svg.getScreenCTM();
    if (matrix === null) throw new Error("no screen transform");
    const regions = [...svg.querySelectorAll("path.map-region")].filter((path): path is SVGPathElement => path instanceof SVGPathElement);
    const inAnyRegion = (point: DOMPoint): boolean => regions.some((region) => region.isPointInFill(point));
    const onScreen = (point: DOMPoint): boolean => point.x > surface.left + 20 && point.x < surface.right - 20 && point.y > surface.top + 20 && point.y < surface.bottom - 20;
    const found: { land: { x: number; y: number }; sea: { x: number; y: number } }[] = [];
    for (const path of regions) {
      const length = path.getTotalLength();
      for (let distance = 0; distance < length && found.length < 60; distance += 3) {
        const a = path.getPointAtLength(distance);
        const b = path.getPointAtLength(Math.min(length, distance + 0.5));
        const size = Math.hypot(b.x - a.x, b.y - a.y);
        if (size === 0) continue;
        const normal = { x: -(b.y - a.y) / size, y: (b.x - a.x) / size };
        const at = (offset: number): DOMPoint => new DOMPoint(a.x + normal.x * offset, a.y + normal.y * offset);
        const side = path.isPointInFill(at(1.2)) ? 1 : -1;
        const land = at(1.2 * side);
        const sea = at(-1.2 * side);
        // Skip capes, spits, lagoons, and estuaries: each probe must sit at least 1 km from any other shore.
        const around = (centre: DOMPoint): DOMPoint[] => Array.from({ length: 8 }, (_, index) =>
          new DOMPoint(centre.x + Math.cos(index * Math.PI / 4), centre.y + Math.sin(index * Math.PI / 4)));
        if (!around(land).every((point) => path.isPointInFill(point)) || around(sea).some(inAnyRegion)) continue;
        const landOnScreen = land.matrixTransform(matrix);
        const seaOnScreen = sea.matrixTransform(matrix);
        if (!onScreen(landOnScreen) || !onScreen(seaOnScreen)) continue;
        found.push({ land: { x: landOnScreen.x, y: landOnScreen.y }, sea: { x: seaOnScreen.x, y: seaOnScreen.y } });
      }
    }
    return found;
  });
  expect(pairs.length).toBeGreaterThanOrEqual(20);

  const scale = await page.evaluate(() => window.devicePixelRatio);
  const { data, info } = await sharp(await page.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const color = ({ x, y }: { x: number; y: number }): [number, number, number] => {
    const offset = (Math.round(y * scale) * info.width + Math.round(x * scale)) * info.channels;
    return [data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0];
  };
  // Baked land is warm (red over blue); the baked sea is cool (blue over red).
  const agreeing = pairs.filter(({ land, sea }) => {
    const [landRed, , landBlue] = color(land);
    const [seaRed, , seaBlue] = color(sea);
    return landRed > landBlue && seaBlue - seaRed > 10;
  });
  expect(agreeing.length / pairs.length).toBeGreaterThanOrEqual(0.95);
});

test("keeps operational counter text legible (V5)", async ({ page }) => {
  await openSetup(page);
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await expect(page.locator(".map-vector")).toBeVisible();
  for (let step = 0; step < 2; step += 1) await page.getByRole("button", { name: "Zoom in" }).click();
  const size = await page.locator(".unit-counter-designation").first().evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(size).toBeGreaterThanOrEqual(11);
});

test("reports missing terrain textures and keeps the game playable", async ({ page }) => {
  // Abort the image requests only, not Vite's dev-mode `?url` module for the same file.
  await page.route(/iberia-relief-[^?]*\.webp$/, (route) => route.abort());
  await openSetup(page);
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await mapReady(page);
  await expect(page.getByText(/could not be loaded/)).toBeVisible();
  await selectTerritory(page, "madrid");
  await expect((await pane(page, "Orders")).getByRole("heading", { name: "Madrid" })).toBeVisible();
});

test("guards direct routes and keeps settings accessible", async ({ page }) => {
  for (const path of ["./#/orders", "./#/handoff", "./#/resolution", "./#/game-over"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
  }
  await expectAccessible(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expectAccessible(page);
});
