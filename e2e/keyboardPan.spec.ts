import { expect, test } from "@playwright/test";
import { waitForCameraStill } from "./mapCamera";

// K1: holding a pan key moves the map continuously. Assertions are tolerant on purpose: frame
// timing varies between machines and browsers, so they check shape, not pixel counts.

test("holding D pans the map right in small, steady steps (K1)", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await expect(page.locator(".map-vector")).toBeVisible();
  const surface = page.locator(".map-surface");
  await surface.focus();
  // Zoomed in, so a half-second pan never reaches the edge of the map.
  for (let step = 0; step < 4; step += 1) await page.keyboard.press("+");
  await expect(surface).toHaveAttribute("data-zoom", "2.00");

  await page.evaluate(() => {
    const map = document.querySelector(".map-surface");
    const samples: number[] = [];
    Object.assign(window, { panSamples: samples });
    const sample = (): void => {
      samples.push(Number(map?.getAttribute("data-camera-x")));
      if (samples.length < 600) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.keyboard.down("d");
  await page.waitForTimeout(500);
  await page.keyboard.up("d");
  await waitForCameraStill(page);
  const samples = await page.evaluate(() => (window as unknown as { panSamples: number[] }).panSamples.slice());

  const steps = samples.slice(1).map((x, index) => x - (samples[index] ?? x));
  const moving = steps.filter((step) => step !== 0);
  const total = steps.reduce((sum, step) => sum + step, 0);
  expect(total).toBeGreaterThan(0);
  // Never backwards, in several steps, and no single step carries a large share of the pan.
  expect(steps.every((step) => step >= 0)).toBe(true);
  expect(moving.length).toBeGreaterThanOrEqual(5);
  expect(Math.max(...moving)).toBeLessThan(total / 3);
  // The pan stopped with the key: the last samples hold still.
  expect(new Set(samples.slice(-3)).size).toBe(1);
});
