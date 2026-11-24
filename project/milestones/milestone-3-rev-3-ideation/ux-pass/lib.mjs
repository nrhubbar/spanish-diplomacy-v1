// Milestone 3 Rev 3 UX pass: shared browser helpers, adapted from the Rev 2 ux-pass (render.mjs).
//   npx vite --host 127.0.0.1 --port 5330 --strictPort --mode e2e      # in another shell
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";
import sharp from "sharp";

export const here = dirname(fileURLToPath(import.meta.url));
export const out = join(here, "out");
export const images = resolve(here, "../images");
const base = `http://127.0.0.1:${process.env.E2E_PORT ?? "5330"}/assets/`;
const driverJs = await readFile(join(here, "driver.js"), "utf8");
await mkdir(out, { recursive: true });
await mkdir(images, { recursive: true });

export const browser = await chromium.launch();
export async function newPage(kind = "desktop", size) {
  const ctx = await browser.newContext(kind === "phone"
    ? { ...devices["Pixel 7"], ...(size ? { viewport: size } : {}) }
    : { viewport: size ?? { width: 1440, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  await page.addInitScript(() => {
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = () => (...enhancers) => (create) => (...args) => {
      const store = enhancers.reduceRight((next, enhancer) => enhancer(next), create)(...args);
      window.__store = store;
      return store;
    };
  });
  await page.goto(base);
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.addScriptTag({ content: driverJs });
  return page;
}
export async function waitForMap(page) {
  await page.locator(".map-surface .map-vector").waitFor();
  if (await page.locator(".terrain-layer").count() > 0) await page.locator('.terrain-layer[data-refined="true"]').waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(400);
}
export async function start(page, opts = {}) {
  await page.evaluate((o) => window.M3D.midgame(o), opts);
  await waitForMap(page);
  const toggle = page.getByRole("button", { exact: true, name: "Briefing" });
  if (await toggle.isVisible().catch(() => false) && await toggle.getAttribute("aria-pressed") === "true") await toggle.click();
  await page.waitForTimeout(200);
}
export const openView = (page, view) => page.evaluate((v) => { window.__store.dispatch({ type: "pane/openView", payload: v }); }, view);
export async function css(page, text) { if (text) await page.addStyleTag({ content: text }); }
export async function shot(page, name, { clip, locator, final = false, width = 1600, quality = 80 } = {}) {
  const png = join(out, `${name}.png`);
  if (locator) await page.locator(locator).first().screenshot({ path: png, animations: "disabled" });
  else await page.screenshot({ path: png, clip, animations: "disabled" });
  if (final) {
    const meta = await sharp(png).metadata();
    const img = sharp(png);
    if (meta.width > width) img.resize({ width });
    await img.webp({ quality }).toFile(join(images, `r3-${name}.webp`));
  }
}
/** Joins several PNGs side by side on a paper ground with captions. */
export async function sheet(name, items, opts = {}) {
  const { gap = 24, bg = "#e9e2d3", maxWidth = 1600, quality = 80, captionH = 34, pad = 20, height } = opts;
  const tiles = [];
  for (const it of items) {
    let b = sharp(join(out, `${it.src}.png`));
    const m0 = await b.metadata();
    let buf = await b.png().toBuffer();
    if (height && m0.height !== height) buf = await sharp(buf).resize({ height }).png().toBuffer();
    if (it.scale) buf = await sharp(buf).resize({ width: Math.round(m0.width * it.scale) }).png().toBuffer();
    const m = await sharp(buf).metadata();
    tiles.push({ buf, w: m.width, h: m.height, caption: it.caption ?? "" });
  }
  const cols = opts.cols ?? tiles.length;
  const rowsN = Math.ceil(tiles.length / cols);
  const rowH = Array.from({ length: rowsN }, (_, r) => Math.max(...tiles.slice(r * cols, (r + 1) * cols).map((t) => t.h)) + captionH + 10);
  const W = Math.max(...Array.from({ length: rowsN }, (_, r) => tiles.slice(r * cols, (r + 1) * cols).reduce((s2, t) => s2 + t.w + gap, -gap))) + pad * 2;
  const H = rowH.reduce((p, q) => p + q, 0) + pad * 2;
  const comps = [];
  let x = pad, y = pad;
  tiles.forEach((t, i) => {
    if (i % cols === 0) { x = pad; if (i > 0) y += rowH[i / cols - 1]; }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${t.w}" height="${captionH}"><text x="0" y="22" font-family="Helvetica, Arial" font-size="17" font-weight="700" fill="#241d18">${t.caption.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text></svg>`;
    comps.push({ input: Buffer.from(svg), left: x, top: y });
    comps.push({ input: t.buf, left: x, top: y + captionH });
    x += t.w + gap;
  });
  const full = await sharp({ create: { width: W, height: H, channels: 3, background: bg } }).composite(comps).png().toBuffer();
  let img = sharp(full);
  if (W > maxWidth) img = img.resize({ width: maxWidth });
  await img.webp({ quality }).toFile(join(images, `r3-${name}.webp`));
}
