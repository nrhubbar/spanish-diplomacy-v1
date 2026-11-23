import { type CDPSession, expect, type Page, test } from "@playwright/test";
import { waitForCameraStill } from "./mapCamera";

// Performance budgets P2, P3, and P5 (Revision 5, section 8.3), and the held-key panning cost
// (Revision 7, C.3). Chromium only; numbers are printed so they can be recorded, and asserted
// against the recorded budgets with room to spare: these are guards against a gross regression,
// not measurements.

/**
 * How far over its budget a measurement may go. The tests run next to each other and on hosts of
 * any speed, so a time says as much about the host as about the game.
 */
const hostSlack = 10;

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== "chromium", "Budgets are measured in Chromium.");
});

test("P2 and P3: interactive map and selection response", async ({ page, isMobile }) => {
  if (isMobile) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  const started = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await expect(page.locator(".map-vector")).toBeVisible();
  const interactive = await page.evaluate((start) => performance.now() - start, started);
  // Median of several selections, so one scheduling hiccup on a busy machine does not fail
  // the budget; alternating territories forces a real selection change every time.
  const selection = await page.evaluate(async () => {
    const samples: number[] = [];
    for (const territoryId of ["madrid", "valencia", "madrid", "valencia", "madrid", "valencia", "madrid"]) {
      const region = document.querySelector(`.map-region[data-territory-id="${territoryId}"]`);
      if (!(region instanceof SVGElement)) throw new Error("no region");
      const start = performance.now();
      region.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    return samples[Math.floor(samples.length / 2)] ?? Number.POSITIVE_INFINITY;
  });
  console.log(`PERF ${test.info().project.name} interactive=${interactive.toFixed(0)}ms selection=${selection.toFixed(1)}ms`);
  // The budget is 2.5 s, or 4 s on a phone, and it measures well inside that.
  expect(interactive).toBeLessThan(10_000);
  expect(selection).toBeLessThan(hostSlack * (isMobile ? 120 : 50));
});

test("P5: repeated games leave no canvases or WebGL contexts behind", async ({ page, isMobile }) => {
  test.skip(isMobile, "Measured once, on desktop.");
  await page.goto("./");
  for (let cycle = 0; cycle < 20; cycle += 1) {
    await page.getByRole("button", { name: "Create Game" }).click();
    await page.getByRole("button", { name: "Start Campaign" }).click();
    await expect(page.locator(".map-vector")).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Menu" }).click();
    await page.getByRole("button", { name: "Exit Game" }).click();
    await page.getByRole("button", { name: "Leave" }).click();
    await expect(page.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
  }
  await expect(page.locator("canvas")).toHaveCount(0);
  const warnings: string[] = [];
  page.on("console", (message) => { if (/Too many active WebGL contexts/.test(message.text())) warnings.push(message.text()); });
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await expect(page.locator(".terrain-layer")).toHaveAttribute("data-renderer", "webgl", { timeout: 15000 });
  expect(warnings).toEqual([]);
});

interface PanCost {
  readonly frames: number;
  /** Frame intervals in ms. */
  readonly max: number;
  readonly p50: number;
  readonly p95: number;
  /** JavaScript time per frame (React render, counter layout, the pan loop), from DevTools. */
  readonly script: number;
  /** Style recalculation and layout time per frame. */
  readonly style: number;
}

/** Holds a pan key at the current zoom and measures every frame of the pan. */
async function holdPan(page: Page, cdp: CDPSession, key: "a" | "d", ms = 1000): Promise<PanCost> {
  const durations = async (): Promise<{ readonly script: number; readonly style: number }> => {
    const { metrics } = await cdp.send("Performance.getMetrics");
    const value = (name: string): number => metrics.find((metric) => metric.name === name)?.value ?? 0;
    return { script: value("ScriptDuration"), style: value("RecalcStyleDuration") + value("LayoutDuration") };
  };
  await page.evaluate(() => {
    const times: number[] = [];
    Object.assign(window, { panFrames: times, panSampling: true });
    const sample = (time: number): void => {
      times.push(time);
      if ((window as unknown as { panSampling: boolean }).panSampling) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const before = await durations();
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  const times = await page.evaluate(() => {
    Object.assign(window, { panSampling: false });
    return (window as unknown as { panFrames: number[] }).panFrames.slice();
  });
  const after = await durations();
  await waitForCameraStill(page);
  const intervals = times.slice(1).map((time, index) => time - (times[index] ?? time)).sort((a, b) => a - b);
  const at = (share: number): number => intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * share))] ?? Number.POSITIVE_INFINITY;
  const perFrame = (seconds: number): number => (seconds * 1000) / Math.max(1, intervals.length);
  return {
    frames: intervals.length,
    max: at(1),
    p50: at(0.5),
    p95: at(0.95),
    script: perFrame(after.script - before.script),
    style: perFrame(after.style - before.style)
  };
}

const describeCost = (cost: PanCost): string =>
  `frames=${String(cost.frames)} p50=${cost.p50.toFixed(1)}ms p95=${cost.p95.toFixed(1)}ms max=${cost.max.toFixed(1)}ms script=${cost.script.toFixed(1)}ms/frame style+layout=${cost.style.toFixed(1)}ms/frame`;

/**
 * Starts a game with the map focused, and returns the one DevTools session that measures it.
 * On a phone it also holds the 4x CPU throttle; detaching any session would lift the throttle.
 */
async function startPanning(page: Page, isMobile: boolean): Promise<CDPSession> {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await expect(page.locator(".map-vector")).toBeVisible();
  await expect(page.locator(".terrain-layer")).toHaveAttribute("data-renderer", /./, { timeout: 15000 });
  await page.locator(".map-surface").focus();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  if (isMobile) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  return cdp;
}

// A 60 Hz frame is 16.7 ms. Every camera change re-renders the map and lays out the counters
// again. These run against the development build, whose React adds several times the work of
// production. The budget for JavaScript per frame is one frame on desktop and four on a 4x
// throttled phone. Frame intervals are printed, not asserted: headless Chromium draws the WebGL
// relief in software, which dominates them (compare the flat-map run).
const scriptLimit = (isMobile: boolean): number => hostSlack * (isMobile ? 66 : 16.7);

test("C.3: per-frame cost while holding a pan key", async ({ page, isMobile }) => {
  const cdp = await startPanning(page, isMobile);
  const surface = page.locator(".map-surface");
  // A first, discarded pan, so warm-up work does not count against the first zoom.
  await holdPan(page, cdp, "a", 300);
  const report: string[] = [];
  // 100% sums every stack; 125% lays out individual counters and checks them for crowding,
  // the most expensive layout; 175% is the operational level with its larger counters.
  for (const [zoom, presses, key] of [["1.00", 0, "d"], ["1.25", 1, "a"], ["1.75", 2, "d"]] as const) {
    for (let press = 0; press < presses; press += 1) await page.keyboard.press("+");
    await expect(surface).toHaveAttribute("data-zoom", zoom);
    const cost = await holdPan(page, cdp, key);
    report.push(`zoom=${zoom} ${describeCost(cost)}`);
    expect(cost.frames).toBeGreaterThan(1);
    expect(cost.script).toBeLessThan(scriptLimit(isMobile));
  }
  console.log(`PERF-PAN ${test.info().project.name} ${report.join(" | ")}`);
  });

test("C.3: panning keeps pace on the flat map", async ({ page, isMobile }) => {
  await page.route(/iberia-relief-[^?]*\.webp$/, (route) => route.abort());
  const cdp = await startPanning(page, isMobile);
  await holdPan(page, cdp, "a", 300);
  await page.keyboard.press("+");
  await expect(page.locator(".map-surface")).toHaveAttribute("data-zoom", "1.25");
  const cost = await holdPan(page, cdp, "d");
  console.log(`PERF-PAN-FLAT ${test.info().project.name} zoom=1.25 ${describeCost(cost)}`);
  expect(cost.script).toBeLessThan(scriptLimit(isMobile));
  // Without the software-drawn relief, the budget for the median desktop frame is 30 Hz (it
  // measures 60 Hz alone).
  if (!isMobile) expect(cost.p50).toBeLessThan(hostSlack * 34);
  });
