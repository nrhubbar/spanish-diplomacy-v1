// Renders the Milestone 3 ideation mockups to WebP.
//
//   node project/milestones/milestone-3-ideation/mockups/render.mjs [--bases-only] [id ...]
//
// 1. Refreshes the base screenshots in mockups/base/ from `npm run e2e:capture` output
//    (build/e2e/screenshots), falling back to the committed baselines in e2e/baselines/chromium.
//    Bases are kept as WebP so the committed HTML sources stay self-contained.
// 2. Writes the plain current-UI captures to images/current-*.webp.
// 3. Screenshots every mockup page (mockups/<id>.html) with Playwright's Chromium and converts
//    it with sharp to images/<id>.webp (quality ~80, 1200 px wide for desktop pages).
//
// Each page declares its viewport with <meta name="mock-size" content="WIDTHxHEIGHT"> and its
// output width with <meta name="mock-out" content="1200">.

import { existsSync } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const images = resolve(here, "../images");
const baseDir = join(here, "base");
const captures = join(repo, "build/e2e/screenshots");
const baselines = join(repo, "e2e/baselines/chromium");

/** base name -> [capture file, committed-baseline fallback] */
const bases = {
  "setup": ["chromium-02-setup.png", "setup.png"],
  "planning": ["chromium-05-planned-orders.png", "planning-overview.png"],
  "order-menu": ["chromium-04b-order-menu.png", "planning-overview.png"],
  "operational": ["chromium-06-operational-zoom.png", "planning-operational.png"],
  "detail": ["chromium-07-detail-zoom.png", "planning-detail.png"],
  "detail-madrid": ["chromium-17a-counters-detail.png", "planning-detail.png"],
  "battle": ["chromium-19a-battle-cards.png", "resolution.png"]
};

/** Plain current-UI captures: name -> [capture file, fallback, output width]. */
const current = {
  "current-setup": ["chromium-02-setup.png", "setup.png", 1200],
  "current-planning": ["chromium-05-planned-orders.png", "planning-overview.png", 1200],
  "current-resolution": ["chromium-19a-battle-cards.png", "resolution.png", 1200],
  "current-planning-phone": ["mobile-chromium-05-planned-orders.png", null, 420]
};

const ids = [
  "setup-timer", "planning-resources", "city-build", "partition-map", "rail-lane", "unit-counters",
  "general-chip", "d20-battle-card", "weather-badge", "movement-exhaustion", "harness-report"
];

function source(capture, fallback) {
  const fromCapture = join(captures, capture);
  if (existsSync(fromCapture)) return { path: fromCapture, fallback: false };
  if (fallback !== null && existsSync(join(baselines, fallback))) return { path: join(baselines, fallback), fallback: true };
  return null;
}

async function encode(input, output, width, quality = 80) {
  let q = quality;
  for (;;) {
    await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: q, effort: 6 }).toFile(output);
    const { size } = await stat(output);
    if (size <= 250 * 1024 || q <= 55) return size;
    q -= 6;
  }
}

async function refreshBases() {
  await mkdir(baseDir, { recursive: true });
  for (const [name, [capture, fallback]] of Object.entries(bases)) {
    const output = join(baseDir, `${name}.webp`);
    // Overlays are hand-placed on the captured camera states, so a committed base is preferred
    // over a committed baseline (a different camera state); baselines only fill a missing base.
    const fromCapture = join(captures, capture);
    const found = existsSync(fromCapture) ? { path: fromCapture, fallback: false }
      : existsSync(output) ? null : source(capture, fallback);
    if (found === null) {
      if (!existsSync(output)) throw new Error(`No source for base ${name}`);
      console.log(`base ${name} kept (no fresh capture)`);
      continue;
    }
    await sharp(found.path).webp({ quality: 90 }).toFile(output);
    console.log(`base ${name} <- ${found.fallback ? "baseline" : "capture"} ${found.path.split("/").pop()}`);
  }
}

async function writeCurrent() {
  for (const [name, [capture, fallback, width]] of Object.entries(current)) {
    const found = source(capture, fallback);
    if (found === null) { console.log(`skip ${name}: no source`); continue; }
    const size = await encode(found.path, join(images, `${name}.webp`), width);
    console.log(`${name}.webp ${(size / 1024).toFixed(0)} KB`);
  }
}

async function renderMockups(selected) {
  const browser = await chromium.launch();
  try {
    for (const id of selected) {
      const file = join(here, `${id}.html`);
      const html = await readFile(file, "utf8");
      const [width, height] = (/name="mock-size" content="(\d+)x(\d+)"/.exec(html) ?? [0, "1440", "800"]).slice(1).map(Number);
      const out = Number((/name="mock-out" content="(\d+)"/.exec(html) ?? [0, "1200"])[1]);
      const page = await browser.newPage({ deviceScaleFactor: out > width ? 2 : 1, viewport: { height, width } });
      await page.goto(pathToFileURL(file).href);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
      });
      await page.waitForTimeout(100);
      const png = await page.screenshot({ type: "png" });
      await page.close();
      const size = await encode(png, join(images, `${id}.webp`), out);
      console.log(`${id}.webp ${(size / 1024).toFixed(0)} KB`);
    }
  } finally {
    await browser.close();
  }
}

await mkdir(images, { recursive: true });
const requested = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
if (requested.length === 0) {
  await refreshBases();
  await writeCurrent();
}
if (!process.argv.includes("--bases-only")) await renderMockups(requested.length === 0 ? ids : requested);
