import { expect, type Page } from "@playwright/test";

/**
 * Waits until keyboard panning has come to rest: each tap glides its step over a few frames
 * (K1), so the view box must hold still for several frames in a row.
 */
export async function waitForCameraStill(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const viewBox = (): string | null => document.querySelector("svg.map-vector")?.getAttribute("viewBox") ?? null;
    let last = viewBox();
    let still = 0;
    while (still < 5) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const current = viewBox();
      still = current === last ? still + 1 : 0;
      last = current;
    }
  });
}

/**
 * Zooms the map to its maximum with the keyboard, then pans with the keyboard until the named
 * city is near the middle. Keyboard input works the same in every project, including mobile
 * WebKit, which has no wheel input.
 */
export async function zoomFullyOn(page: Page, city: string): Promise<void> {
  const surface = page.locator(".map-surface");
  await surface.focus();
  await page.keyboard.press("0");
  for (let step = 0; step < 12; step += 1) await page.keyboard.press("+");
  await expect(surface).toHaveAttribute("data-zoom", "4.00");
  const frame = await surface.boundingBox();
  // The city's map position through the vector layer's screen transform (WebKit reports stale
  // client boxes for SVG text after a viewBox change).
  const target = await page.evaluate((name) => {
    const svg = document.querySelector("svg.map-vector");
    const text = [...document.querySelectorAll(".map-cities text")].find((element) => element.textContent === name);
    const matrix = svg instanceof SVGSVGElement ? svg.getScreenCTM() : null;
    if (!(text instanceof SVGTextElement) || matrix === null) return null;
    return new DOMPoint(Number(text.getAttribute("x")), Number(text.getAttribute("y"))).matrixTransform(matrix).toJSON() as { x: number; y: number };
  }, city);
  if (frame === null || target === null) throw new Error(`no map or no ${city} label`);
  // Each tap glides about 60 px, and quick taps add up.
  const steps = (offset: number): number => Math.round(offset / 60);
  const across = steps(frame.x + frame.width / 2 - target.x);
  const down = steps(frame.y + frame.height / 2 - target.y);
  for (let step = 0; step < Math.abs(across); step += 1) await page.keyboard.press(across > 0 ? "a" : "d");
  for (let step = 0; step < Math.abs(down); step += 1) await page.keyboard.press(down > 0 ? "w" : "s");
  await waitForCameraStill(page);
}
