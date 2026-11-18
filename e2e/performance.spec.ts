import { expect, test } from "@playwright/test";

// Performance budgets P2, P3, and P5 (Revision 5, section 8.3). Chromium only; numbers are
// printed so they can be recorded, and asserted against the recorded budgets.

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
  expect(interactive).toBeLessThan(isMobile ? 4000 : 2500);
  expect(selection).toBeLessThan(isMobile ? 120 : 50);
});

test("P5: repeated games leave no canvases or WebGL contexts behind", async ({ page, isMobile }) => {
  test.skip(isMobile, "Measured once, on desktop.");
  await page.goto("./");
  for (let cycle = 0; cycle < 20; cycle += 1) {
    await page.getByRole("button", { name: "Create Game" }).click();
    await page.getByRole("button", { name: "Start Campaign" }).click();
    await expect(page.locator(".map-vector")).toBeVisible();
    await page.getByRole("button", { name: "Exit game" }).click();
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
