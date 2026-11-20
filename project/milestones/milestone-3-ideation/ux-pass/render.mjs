// Milestone 3 UX pass: drives the live app, injects mock UI (mock.js, mock.css) and captures
// each design option. Every capture uses the same mock world, so features stack: each image
// varies one feature and shows the others at their defaults.
//
//   E2E_PORT=5291 npx vite --host 127.0.0.1 --port 5291 --strictPort --mode e2e   # in another shell
//   E2E_PORT=5291 node project/milestones/milestone-3-ideation/ux-pass/render.mjs [id ...]
//
// Writes ux-pass/out/<id>.png and images/ux-<id>.webp. Throwaway design tooling, not game code.
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const out = join(here, "out");
const images = resolve(here, "../images");
const base = `http://127.0.0.1:${process.env.E2E_PORT ?? "5291"}/assets/`;
const provinces = JSON.parse(await readFile(join(here, "provinces.json"), "utf8"));
const map = JSON.parse(await readFile(join(repo, "src/main/scenarios/spain-1936-07-31/map.json"), "utf8"));
const mockJs = await readFile(join(here, "mock.js"), "utf8");
const mockCss = await readFile(join(here, "mock.css"), "utf8");

async function waitForMap(page) {
  await page.locator(".map-surface .map-vector").waitFor();
  if (await page.locator(".terrain-layer").count() > 0) {
    await page.locator('.terrain-layer[data-refined="true"]').waitFor({ timeout: 20000 });
  }
  await page.waitForTimeout(400);
}
async function start(page, extra = {}) {
  await page.goto(base);
  await page.getByRole("button", { name: "Create Game" }).click();
  if (extra.setup) return;
  await page.getByRole("button", { name: "Start Campaign" }).click();
  await waitForMap(page);
  const hide = page.getByRole("button", { name: /Hide briefing/ });
  if (await hide.isVisible().catch(() => false)) await hide.click();
}
async function inject(page, data = {}) {
  await page.addStyleTag({ content: mockCss });
  await page.evaluate(([p, m, d]) => { window.__M3 = { provinces: p, map: m, ...d }; }, [provinces, map, data]);
  await page.addScriptTag({ content: mockJs });
}
async function select(page, territory) {
  await page.locator(`.map-region[data-territory-id="${territory}"]`).focus();
  await page.keyboard.press("Enter");
  const orders = page.getByRole("button", { name: "Orders", exact: true });
  if (await orders.isVisible().catch(() => false)) await orders.click();
  await page.waitForTimeout(200);
}
async function still(page) {
  await page.evaluate(async () => {
    const vb = () => document.querySelector("svg.map-vector")?.getAttribute("viewBox");
    let last = vb(), n = 0;
    while (n < 6) { await new Promise((r) => requestAnimationFrame(r)); const c = vb(); n = c === last ? n + 1 : 0; last = c; }
  });
}
/** Zooms in `steps` keyboard steps, then pans so map point (x, y) km sits mid-map, left of the pane. */
async function zoomOn(page, x, y, steps) {
  const surface = page.locator(".map-surface");
  await surface.focus();
  await page.keyboard.press("0");
  for (let i = 0; i < steps; i += 1) await page.keyboard.press("+");
  await still(page);
  for (let pass = 0; pass < 3; pass += 1) {
    const { target, centre } = await page.evaluate(([kx, ky]) => {
      const svg = document.querySelector("svg.map-vector");
      const p = new DOMPoint(kx, ky).matrixTransform(svg.getScreenCTM());
      const s = document.querySelector(".map-surface").getBoundingClientRect();
      const pane = document.querySelector(".map-pane");
      const pr = pane ? pane.getBoundingClientRect() : null;
      const right = pr && pane.dataset.layout === "side" && pane.dataset.open === "true" ? pr.left : s.right;
      const bottom = pr && pane.dataset.layout !== "side" && pane.dataset.open === "true" ? pr.top : s.bottom;
      return { target: { x: p.x, y: p.y }, centre: { x: (s.left + right) / 2, y: (s.top + bottom) / 2 } };
    }, [x, y]);
    const across = Math.round((centre.x - target.x) / 60), down = Math.round((centre.y - target.y) / 60);
    if (!across && !down) break;
    for (let i = 0; i < Math.abs(across); i += 1) await page.keyboard.press(across > 0 ? "a" : "d");
    for (let i = 0; i < Math.abs(down); i += 1) await page.keyboard.press(down > 0 ? "w" : "s");
    await still(page);
  }
}
const M = (page, fn, ...args) => page.evaluate(([f, a]) => window.M3[f](...a), [fn, args]);

// Defaults every capture shares unless it is the feature being varied.
const D = { header: "a", subterr: "a", rail: "a", pane: "a" };
async function world(page, o = {}) {
  const c = { ...D, ...o };
  await inject(page, { recruitOpt: c.recruit ?? "a", recruitHover: c.recruitHover });
  await M(page, "header", c.header);
  await M(page, "subterr", c.subterr, c.zoomedTerritory ?? null);
  if (c.rail) await M(page, "rail", c.rail, "madrid");
  return c;
}
async function catalunyaPane(page, opt, tab) {
  await select(page, "catalunya");
  const armies = await M(page, "readArmies");
  await M(page, "paneTerritory", opt, armies, tab);
}

const shots = {
  // ---- World at defaults ----
  "world": { title: "The mock world at its defaults", run: async (p) => { await start(p); await world(p); await catalunyaPane(p, "a", "units"); } },
  // ---- Sub-territories on the map ----
  "subterr-a": { title: "Sub-territories A: provinces on contested ground", run: async (p) => { await start(p); await world(p, { subterr: "a", rail: null }); await select(p, "andalucia"); } },
  "subterr-a-zoom": { title: "Sub-territories A at operational zoom", run: async (p) => { await start(p); await select(p, "andalucia"); await zoomOn(p, -170, 300, 3); await world(p, { subterr: "a", rail: null }); } },
  "subterr-b": { title: "Sub-territories B: provinces everywhere", run: async (p) => { await start(p); await world(p, { subterr: "b", rail: null }); await select(p, "andalucia"); } },
  "subterr-c": { title: "Sub-territories C: hatch, split bar and front line", run: async (p) => { await start(p); await world(p, { subterr: "c", rail: null }); await select(p, "andalucia"); } },
  "subterr-c-zoom": { title: "Sub-territories C zoomed on Andalucía", run: async (p) => { await start(p); await select(p, "andalucia"); await zoomOn(p, -170, 300, 3); await world(p, { subterr: "c", rail: null, zoomedTerritory: "andalucia" }); } },
  // ---- Territory pane ----
  "pane-a-units": { title: "Territory pane A: tabs (Units)", run: async (p) => { await start(p); await world(p); await catalunyaPane(p, "a", "units"); } },
  "pane-a-build": { title: "Territory pane A: tabs (Build)", run: async (p) => { await start(p); await world(p); await catalunyaPane(p, "a", "build"); } },
  "pane-b": { title: "Territory pane B: one scroll with sections", run: async (p) => { await start(p); await world(p); await catalunyaPane(p, "b"); } },
  "pane-c": { title: "Territory pane C: sub-territory cards first", run: async (p) => { await start(p); await world(p); await catalunyaPane(p, "c"); } },
  "pane-focus": { title: "Zoomed in on one sub-territory (Barcelona)", run: async (p) => { await start(p); await select(p, "catalunya"); await zoomOn(p, provinces.find((x) => x.id === "barcelona").cx, provinces.find((x) => x.id === "barcelona").cy, 4); await world(p, { zoomedTerritory: "catalunya", subterr: "b" }); await M(p, "focusSub", "barcelona"); await M(p, "paneSubFocus"); } },
  // ---- Orders: contested defaults and Replenish ----
  "orders-contested": { title: "Orders in contested ground", run: async (p) => { await start(p); await world(p, { rail: null }); await select(p, "andalucia"); const a = await M(p, "readArmies"); await M(p, "paneContested", a); await scrollPane(p, ".formation-list li:nth-child(2)"); } },
  "orders-replenish": { title: "Replenish order", run: async (p) => { await start(p); await world(p, { rail: null }); await select(p, "catalunya"); const a = await M(p, "readArmies"); await M(p, "paneReplenish", a); await scrollPane(p, ".formation-list li:nth-child(2)"); } },
  // ---- Recruitment ----
  "recruit-a": { title: "Recruitment A: list with costs, locked types say why", run: async (p) => { await start(p); await world(p, { recruit: "a", recruitHover: "artillery" }); await catalunyaPane(p, "a", "recruit"); await M(p, "recruitTooltip", "artillery", ["Artillery group: locked", "Needs a Factory in Barcelona. One is being built: ready in 2 turns.", "Also needs: Barracks ✓"]); } },
  "recruit-b": { title: "Recruitment B: card grid", run: async (p) => { await start(p); await world(p, { recruit: "b", recruitHover: "tank" }); await catalunyaPane(p, "a", "recruit"); await M(p, "recruitTooltip", "tank", ["Tanks: locked", "Needs a Factory (being built, 2 turns) and a Depot ✓.", "30 Funds · 0.5k men · 4 turns to train"]); } },
  // ---- Move targets ----
  "move-a": { title: "Move targets A: chips on each destination", run: async (p) => { await start(p); await world(p, { rail: null }); await moveFromMadrid(p); await M(p, "moveTargets", "a"); } },
  "move-b": { title: "Move targets B: detail card for the hovered destination", run: async (p) => { await start(p); await world(p, { rail: null }); await moveFromMadrid(p); await M(p, "moveTargets", "b"); } },
  // ---- Rail ----
  "rail-a": { title: "Rail A: every line, weight by level", run: async (p) => { await start(p); await world(p, { rail: "a" }); await catalunyaPane(p, "a", "units"); } },
  "rail-a-zoom": { title: "Rail A at operational zoom (Meseta)", run: async (p) => { await start(p); await select(p, "madrid"); await zoomOn(p, -100, -120, 3); await world(p, { rail: "a", subterr: "b" }); } },
  "rail-b": { title: "Rail B: main lines only at this zoom", run: async (p) => { await start(p); await world(p, { rail: "b" }); await catalunyaPane(p, "a", "units"); } },
  "rail-c": { title: "Rail C: shown only for the selected units", run: async (p) => { await start(p); await world(p, { rail: "c" }); await moveFromMadrid(p); await M(p, "moveTargets", "a"); } },
  // ---- Header and resources ----
  "header-a": { title: "Resources A: in the header", run: async (p) => { await start(p); await world(p, { header: "a" }); await catalunyaPane(p, "a", "units"); } },
  "header-b": { title: "Resources B: at the top of the pane", run: async (p) => { await start(p); await world(p, { header: "b" }); await catalunyaPane(p, "a", "units"); await p.evaluate(() => { document.querySelector(".map-pane-body").insertAdjacentHTML("afterbegin", window.M3.ledgerInPane()); }); } },
  // ---- Battle report ----
  "battle-a": { title: "d20 battle card A: the column as a strip", run: async (p) => { await start(p); await toResolution(p); await world(p, { rail: null }); await M(p, "battle", "a"); } },
  "battle-b": { title: "d20 battle card B: the column as bands", run: async (p) => { await start(p); await toResolution(p); await world(p, { rail: null }); await M(p, "battle", "b"); } },
  "battle-icon": { title: "Battle result icon: hover names the result", run: async (p) => { await start(p); await toResolution(p); await world(p, { rail: null }); await M(p, "battle", "a"); await M(p, "battleIconTooltip"); } },
  // ---- Air ----
  "air-a": { title: "Air A: aircraft counters on the map, mission in the pane", run: async (p) => { await start(p); await select(p, "madrid"); await world(p, { rail: null }); await M(p, "aircraft", "a"); await M(p, "paneAir", "a"); } },
  "air-b": { title: "Air B: an Air list with every aircraft's mission", run: async (p) => { await start(p); await select(p, "madrid"); await world(p, { rail: null }); await M(p, "aircraft", "b"); await M(p, "paneAir", "b"); } },
  // ---- Setup ----
  "setup-timer": { title: "Setup: turn timer", run: async (p) => { await start(p, { setup: true }); await inject(p); await M(p, "setupTimer"); } },
  // ---- Phone ----
  "phone-pane-a": { phone: true, title: "Phone: territory sheet, tabs", run: async (p) => { await start(p); await world(p); await catalunyaPane(p, "a", "build"); await scrollPane(p, ".m3-tabs"); } },
  "phone-pane-b": { phone: true, title: "Phone: territory sheet, sections", run: async (p) => { await start(p); await world(p); await catalunyaPane(p, "b"); await scrollPane(p, "details.m3-acc:nth-of-type(2)"); } },
  "phone-recruit-a": { phone: true, title: "Phone: recruitment list", run: async (p) => { await start(p); await world(p, { recruit: "a" }); await catalunyaPane(p, "a", "recruit"); await scrollPane(p, ".m3-tabs"); } },
  "phone-move-a": { phone: true, title: "Phone: move targets with chips", run: async (p) => { await start(p); await world(p, { rail: null }); await moveFromMadrid(p); await M(p, "moveTargets", "a"); await scrollPane(p, ".m3-army-forming"); } }
};
async function scrollPane(p, sel) { await p.evaluate((s) => { const e = document.querySelector(s); const b = document.querySelector(".map-pane-body"); if (e && b) b.scrollTop += e.getBoundingClientRect().top - b.getBoundingClientRect().top - 8; }, sel); }
async function moveFromMadrid(p) {
  await select(p, "madrid");
  await p.getByRole("button", { name: /Give Selected Armies Order/ }).click();
  await p.getByRole("button", { exact: true, name: "Move" }).click();
  await p.locator(".odds-chip").first().waitFor();
  await p.evaluate(() => { const b = document.querySelector(".order-command .order-button span"); if (b) b.textContent = "Give Selected Units Order"; const w = document.createTreeWalker(document.querySelector(".map-pane") || document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (/Moving \d+ armies/.test(n.textContent)) n.textContent = n.textContent.replace("armies", "units"); });
}
async function toResolution(p) {
  await select(p, "madrid");
  await p.getByRole("button", { name: "End Turn" }).filter({ visible: true }).click();
  await waitForMap(p);
  const report = p.getByRole("button", { name: "Turn report", exact: true });
  if (await report.isVisible().catch(() => false)) await report.click();
  await p.locator(".battle-card").first().waitFor();
  await p.locator(".battle-report h3").evaluate((e) => e.scrollIntoView({ block: "start" })).catch(() => {});
}

const wanted = process.argv.slice(2);
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
for (const [id, s] of Object.entries(shots)) {
  if (wanted.length && !wanted.includes(id)) continue;
  const ctx = await browser.newContext(s.phone ? { ...devices["Pixel 7"] } : { viewport: { width: 1440, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await s.run(page);
    await page.evaluate(() => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
    await page.mouse.move(2, 2);
    await page.waitForTimeout(250);
    const file = join(out, `${id}.png`);
    await page.screenshot({ path: file });
    await sharp(file).resize({ width: s.phone ? 540 : 1440 }).webp({ quality: 82 }).toFile(join(images, `ux-${id}.webp`));
    console.log(`ok   ${id}${errors.length ? "  page errors: " + errors.join(" | ") : ""}`);
  } catch (e) {
    console.log(`FAIL ${id}: ${e.message.split("\n")[0]}`);
  }
  await ctx.close();
}
await browser.close();
