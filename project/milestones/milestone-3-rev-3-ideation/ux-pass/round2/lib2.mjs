// Round 2 helpers: round 1's browser helpers (../lib.mjs), with round 2's own output names.
//   E2E_PORT=5391 node ux-pass/round2/<script>.mjs   (vite on 5391, --mode e2e)
import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
export { browser, newPage, start, openView, css, waitForMap } from "../lib.mjs";
export const here = dirname(fileURLToPath(import.meta.url));
export const out = join(here, "out");
export const images = resolve(here, "../../images");
await mkdir(out, { recursive: true });
export const sc = JSON.parse(await readFile(new URL("../../../../../src/scenarios/spanish-civil-war-1936/scenario.json", import.meta.url), "utf8"));
export async function shot(page, name, { clip, locator } = {}) {
  const path = join(out, `${name}.png`);
  if (locator) await page.locator(locator).first().screenshot({ path, animations: "disabled" });
  else await page.screenshot({ path, clip, animations: "disabled" });
}
/** Joins PNGs in a grid on a paper ground with captions, as a page image (webp, at most 1600 px, under 180 KB). */
export async function sheet(name, items, { gap = 24, pad = 20, cols = items.length, captionH = 34, height, maxWidth = 1600, font = 17 } = {}) {
  const tiles = [];
  for (const it of items) {
    let buf = await sharp(join(out, `${it.src}.png`)).png().toBuffer();
    const m0 = await sharp(buf).metadata();
    if (it.scale) buf = await sharp(buf).resize({ width: Math.round(m0.width * it.scale) }).png().toBuffer();
    else if (height && m0.height !== height) buf = await sharp(buf).resize({ height }).png().toBuffer();
    const m = await sharp(buf).metadata();
    const cap = Array.isArray(it.caption) ? it.caption : [it.caption ?? ""];
    tiles.push({ buf, w: m.width, h: m.height, cap });
  }
  const capH = Math.max(captionH, ...tiles.map((t) => 12 + t.cap.length * (font + 5)));
  const rowsN = Math.ceil(tiles.length / cols);
  const rowH = Array.from({ length: rowsN }, (_, r) => Math.max(...tiles.slice(r * cols, (r + 1) * cols).map((t) => t.h)) + capH + 10);
  const W = Math.max(...Array.from({ length: rowsN }, (_, r) => tiles.slice(r * cols, (r + 1) * cols).reduce((s, t) => s + t.w + gap, -gap))) + pad * 2;
  const H = rowH.reduce((p, q) => p + q, 0) + pad * 2 - 10;
  const comps = []; let x = pad, y = pad;
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  tiles.forEach((t, i) => {
    if (i % cols === 0) { x = pad; if (i > 0) y += rowH[i / cols - 1]; }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${t.w + gap}" height="${capH}">${t.cap.map((c, k) => `<text x="0" y="${font + 3 + k * (font + 5)}" font-family="Helvetica, Arial" font-size="${k === 0 ? font : font - 3}" font-weight="${k === 0 ? 700 : 400}" fill="#241d18">${esc(c)}</text>`).join("")}</svg>`;
    const room = Math.min(t.w + gap, W - x);
    comps.push({ input: await0(svg, room, capH), left: x, top: y });
    comps.push({ input: t.buf, left: x, top: y + capH });
    x += t.w + gap;
  });
  function await0(svg, w, h) { return Buffer.from(svg.replace(/width="\d+"/, `width="${w}"`)); }
  const full = await sharp({ create: { width: W, height: H, channels: 3, background: "#e9e2d3" } }).composite(comps).png().toBuffer();
  const file = join(images, `r3b-${name}.webp`);
  for (const quality of [84, 78, 72, 66, 60]) {
    let img = sharp(full); if (W > maxWidth) img = img.resize({ width: maxWidth });
    await img.webp({ quality }).toFile(file);
    if ((await stat(file)).size < 178 * 1024) break;
  }
  const meta = await sharp(file).metadata();
  console.log(`r3b-${name}.webp ${meta.width}x${meta.height} ${Math.round((await stat(file)).size / 1024)} KB`);
}
