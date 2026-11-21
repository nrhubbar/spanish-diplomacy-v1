// Milestone 3 Rev 2 UX pass: drives the live app to a mid-game state, injects mock UI (mock.js,
// mock-pane.js, mock.css) and captures each sample. Adapted from the Rev 1 ux-pass.
//
//   npx vite --host 127.0.0.1 --port 5310 --strictPort --mode e2e      # in another shell
//   E2E_PORT=5310 node project/milestones/milestone-3-rev-2-ideation/ux-pass/render.mjs [id ...]
//
// Game state: a real game (seed 42), driven through the app's own Redux actions (driver.js). The
// store is reached by defining the Redux DevTools compose hook before the page loads; the dev build
// already calls that hook (store.ts `devTools: import.meta.env.DEV`), so nothing in src/ changes.
// Writes ux-pass/out/<id>.png and images/r2-<id>.webp. Throwaway design tooling, not game code.
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";
import sharp from "sharp";
import { edges, noRoad } from "./graph.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const out = join(here, "out");
const images = resolve(here, "../images");
const base = `http://127.0.0.1:${process.env.E2E_PORT ?? "5310"}/assets/`;
const scenario = JSON.parse(await readFile(join(repo, "src/scenarios/spanish-civil-war-1936/scenario.json"), "utf8"));
const map = JSON.parse(await readFile(join(repo, "src/scenarios/spanish-civil-war-1936/map.json"), "utf8"));
const [driverJs, mockJs, paneJs, mockCss, bJs, bCss] = await Promise.all(["driver.js", "mock.js", "mock-pane.js", "mock.css", "mock-b.js", "mock-b.css"].map((f) => readFile(join(here, f), "utf8")));

// Every graph edge must be a real sub-territory border.
const borders = new Set(scenario.subTerritoryBorders.map(([a, b]) => [a, b].sort().join("|")));
for (const [a, b] of [...edges, ...noRoad]) if (!borders.has([a, b].sort().join("|"))) throw new Error(`graph edge ${a}-${b} is not a border`);

const byId = (list, pick) => Object.fromEntries(list.map((x) => [x.id, pick(x)]));
const data = {
  entries: map.subTerritories.entries,
  subs: byId(scenario.subTerritories, (s) => ({ id: s.id, name: s.name, territoryId: s.territoryId, cityIds: s.cityIds ?? [] })),
  territories: byId(scenario.territories, (t) => ({ id: t.id, name: t.name, capitalSubTerritoryId: t.capitalSubTerritoryId })),
  unitTypes: byId(scenario.unitTypes, (t) => ({ id: t.id, name: t.name, recruit: t.recruit })),
  units: byId(scenario.units, (u) => ({ id: u.id, name: u.name, factionId: u.factionId, type: u.type, fullStrength: u.fullStrength ?? u.strength })),
  buildings: byId(scenario.buildings, (b) => ({ id: b.id, name: b.name, turns: b.turns, cost: b.cost })),
  development: byId(scenario.development, (d) => ({ id: d.id, name: d.name, resource: d.resource, yieldPerLevel: d.yieldPerLevel, upgrade: d.upgrade })),
  factions: byId(scenario.factions, (f) => ({ id: f.id, name: f.name, color: f.color, abbreviation: f.abbreviation })),
  graph: { edges, noRoad }
};

async function waitForMap(page) {
  await page.locator(".map-surface .map-vector").waitFor();
  if (await page.locator(".terrain-layer").count() > 0) {
    await page.locator('.terrain-layer[data-refined="true"]').waitFor({ timeout: 20000 });
  }
  await page.waitForTimeout(400);
}
/** A real game: seed 42, turn 1 played (recruits and builds), turn 2 planned (recruits, a build, a raid). */
async function start(page, opts = {}) {
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
  await page.evaluate((o) => window.M3D.midgame(o), opts);
  await waitForMap(page);
  const toggle = page.getByRole("button", { exact: true, name: "Briefing" });
  if (await toggle.isVisible().catch(() => false) && await toggle.getAttribute("aria-pressed") === "true") await toggle.click();
  await page.waitForTimeout(200);
}
async function inject(page) {
  await page.addStyleTag({ content: mockCss });
  await page.evaluate((d) => { window.__M3 = d; }, data);
  await page.addScriptTag({ content: mockJs });
  await page.addScriptTag({ content: paneJs });
  await page.addStyleTag({ content: bCss });
  await page.addScriptTag({ content: bJs });
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
/** Zooms in `steps` keyboard steps (0.25 each from 100%), then pans so map point (x, y) km sits mid-map. */
async function zoomOn(page, x, y, steps) {
  const surface = page.locator(".map-surface");
  await surface.focus();
  await page.keyboard.press("0");
  for (let i = 0; i < steps; i += 1) await page.keyboard.press("+");
  await still(page);
  for (let pass = 0; pass < 4; pass += 1) {
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
  await page.waitForTimeout(300);
}
const M = (page, fn, ...args) => page.evaluate(([f, a]) => window.M3[f](...a), [fn, args]);
const P = (page, fn, ...args) => page.evaluate(([f, a]) => window.M3P[f](...a), [fn, args]);
async function hidePane(page) {
  const hide = page.getByRole("button", { name: /^Hide (orders|briefing|turn report)/ });
  if (await hide.isVisible().catch(() => false)) await hide.click();
  await page.waitForTimeout(250);
}
async function scrollPane(p, sel) { await p.evaluate((s) => { const e = document.querySelector(s); const b = document.querySelector(".map-pane-body"); if (e && b) b.scrollTop += e.getBoundingClientRect().top - b.getBoundingClientRect().top - 8; }, sel); }
async function chooseMove(page, territory, unitNames) {
  await select(page, territory);
  if (unitNames) {
    await page.getByRole("button", { name: "Clear" }).click();
    for (const n of unitNames) await page.locator(".formation-button", { hasText: n }).click();
  }
  await page.getByRole("button", { name: /Give Selected Units Order/ }).click();
  await page.getByRole("button", { exact: true, name: "Move" }).click();
  await page.waitForTimeout(300);
}

// Map key positions: just right of the zoom controls.
const keyAt = async (page) => page.evaluate(() => { const r = document.querySelector(".map-surface").getBoundingClientRect(); return { x: r.left + 80, y: r.top + 14 }; });

const shots = {
  // ---- 4: sub-territory borders past 250% ----
  "04-zoom-225": { title: "225%: below the threshold", run: async (p) => { await start(p); await hidePane(p); await zoomOn(p, -140, -170, 5); await inject(p); } },
  "04-zoom-275": { title: "275%: sub-territory borders everywhere", run: async (p) => { await start(p); await hidePane(p); await zoomOn(p, -140, -170, 7); await inject(p); await M(p, "subBorders"); } },
  // ---- 6/6a: transport graph ----
  "06-graph": { title: "Rail and roads as a graph (operational zoom)", run: async (p) => { await start(p); await hidePane(p); await zoomOn(p, -150, -190, 2); await inject(p); await M(p, "graph", {}); await M(p, "graphKey", await keyAt(p)); } },
  "06-passes": { title: "Cantabrian passes and no-road borders", run: async (p) => { await start(p); await hidePane(p); await zoomOn(p, -250, -330, 7); await inject(p); await p.evaluate(() => document.body.classList.add("m3-hide-counters")); await M(p, "subBorders"); await M(p, "graph", { passLabels: true, noRoad: true, zoomLevel: "detail" }); await M(p, "graphKey", await keyAt(p), { noRoad: true }); } },
  "06-reach": { title: "Rail reach from Valencia follows connected edges only", run: async (p) => { await start(p); await chooseMove(p, "valencia"); await zoomOn(p, 40, 120, 2); await inject(p); await P(p, "reachValencia"); } },
  // ---- 7: raid order line ends at the target sub-territory ----
  "07-raid": { title: "Bomber raid line ends at Toledo", run: async (p) => { await start(p); await zoomOn(p, -130, -40, 3); await p.locator('.air-counter[data-unit-id="rep-breguet-bombers"]').click(); await p.waitForTimeout(300); await inject(p); await M(p, "raidToSub", "guadalajara"); } },
  // ---- 8: map layers ----
  "08-layers-a": { title: "Layers A: a toolbar along the bottom", run: async (p) => { await start(p); await inject(p); await M(p, "graph", { zoomLevel: "overview" }); await M(p, "layerBar", ["rail", "road", "orders", "contested", "battle", "labels"]); } },
  "08-layers-b": { title: "Layers B: one button, a popover with presets", run: async (p) => { await start(p); await hidePane(p); await inject(p); await M(p, "graph", { zoomLevel: "overview" }); await p.evaluate(() => document.body.classList.add("m3-off-orders")); await M(p, "layersPopover", "Logistics", ["sub", "rail", "road", "supply", "contested", "labels"]); } }
};

/** Real pane markup for a territory, its site cards, and one sub-territory's build list (its focus view). */
async function territoryHarvest(p, territory, sub) {
  await select(p, territory);
  await P(p, "harvest", "territory");
  await p.getByRole("tab", { name: "Build" }).click();
  await P(p, "harvest", "sites");
  if (sub) {
    await p.evaluate((id) => window.M3D.d("game/focusSubTerritory", id), sub);
    await p.locator(".build-list").waitFor();
    await P(p, "harvest", `buildlist:${sub}`);
  }
}
async function chip(p, name) {
  const c = p.locator(".resource-chip").filter({ has: p.locator(`svg`) }).nth(name === "Funds" ? 0 : 1);
  await c.click();
  await p.waitForTimeout(250);
}
const D = (p, type, payload) => p.evaluate(([t, a]) => window.M3D.d(t, a), [type, payload]);
Object.assign(shots, {
  // ---- 9: queue and progress in the Territory Info pane ----
  "09-queues": { title: "What is recruiting and building here", run: async (p) => { await start(p); await inject(p); await select(p, "catalunya"); await P(p, "queuesOnUnitsTab", "catalunya"); await scrollPane(p, ".m3-queue-block"); } },
  // ---- 10: turn report grouped by player ----
  "10-report": { title: "What happened, grouped by player", run: async (p) => { await start(p, { through: "resolution2" }); await inject(p); const r = p.getByRole("button", { name: "Turn report", exact: true }); if (await r.isVisible().catch(() => false)) await r.click(); await P(p, "reportByPlayer"); await scrollPane(p, 'section[aria-labelledby="outcomes-title"]'); } },
  // ---- 11: group Replenish ----
  "11-replenish-a": { title: "Replenish A: one action for the selection", run: async (p) => { await start(p); await inject(p); await select(p, "madrid"); await p.getByRole("button", { name: /Give Selected Units Order/ }).click(); await P(p, "replenishA"); await scrollPane(p, ".formation-list li:nth-child(4)"); } },
  "11-replenish-b": { title: "Replenish B: a column of checkboxes", run: async (p) => { await start(p); await inject(p); await select(p, "madrid"); await P(p, "replenishB"); await scrollPane(p, ".army-picker"); } },
  "11-replenish-after": { title: "After the order: selection is empty", run: async (p) => { await start(p); await inject(p); await select(p, "madrid"); await D(p, "game/clearUnitSelection"); await p.waitForTimeout(200); await P(p, "replenishAfter"); await scrollPane(p, ".formation-list li:nth-child(2)"); } },
  // ---- 15: pane modes ----
  "15-orders-by-type": { title: "Orders mode, grouped by type", run: async (p) => { await start(p); await inject(p); await P(p, "ordersMode", "type"); } },
  "15-orders-by-region": { title: "Orders mode, grouped by region", run: async (p) => { await start(p); await inject(p); await P(p, "ordersMode", "region"); } },
  "15-info-buildings-a": { title: "Territory Info (A): Buildings, Girona open", run: async (p) => { await start(p); await inject(p); await zoomOn(p, 330, -230, 6); await territoryHarvest(p, "catalunya", "girona"); await P(p, "territoryInfo", "catalunya", "buildings", { mode: "a", expanded: "girona" }); await M(p, "tooltipAtSub", "girona", "<b>Zoomed in, clicked Girona</b>The pane opens Cataluña on Buildings, with Girona's card open."); } },
  "15-info-production-a": { title: "Territory Info (A): Production", run: async (p) => { await start(p); await inject(p); await territoryHarvest(p, "catalunya"); await P(p, "territoryInfo", "catalunya", "production", { mode: "a" }); } },
  "15-info-switch-b": { title: "Territory Info (B): persistent tabs", run: async (p) => { await start(p); await inject(p); await territoryHarvest(p, "catalunya"); await P(p, "territoryInfo", "catalunya", "units", { mode: "b" }); } },
  "15-phone-info-a": { phone: true, title: "Phone: Territory Info (A)", run: async (p) => { await start(p); await inject(p); await territoryHarvest(p, "catalunya", "girona"); await P(p, "territoryInfo", "catalunya", "buildings", { mode: "a", expanded: "girona", compact: true }); } },
  // ---- 16: Funds and Manpower balance ----
  "16-funds": { title: "Funds balance by territory", run: async (p) => { await start(p); await inject(p); await chip(p, "Funds"); await P(p, "balance", "funds"); } },
  "16-manpower": { title: "Manpower balance by territory", run: async (p) => { await start(p); await inject(p); await chip(p, "Manpower"); await P(p, "balance", "manpower"); } },
  "16-phone-funds": { phone: true, title: "Phone: Funds balance", run: async (p) => { await start(p); await inject(p); await chip(p, "Funds"); await P(p, "balance", "funds"); } }
});

// ---- Close-out (b-): the decoupled pane, top bar, quick actions, Invade/Reinforce, queues, routes ----
const B = (page, fn, ...args) => page.evaluate(([f, a]) => window.M3B[f](...a), [fn, args]);
/** Selects units on the map by dispatch (the pane stays on "This turn"). */
async function pick(p, from, unitIds, kind) {
  await D(p, "game/clickMapTerritory", from);
  if (unitIds) { await D(p, "game/clearUnitSelection"); for (const id of unitIds) await D(p, "game/toggleUnitSelection", id); }
  if (kind) await D(p, "game/chooseOrderKind", kind);
  await p.waitForTimeout(300);
}
async function deselect(p) { await p.locator(".map-surface").focus(); await p.keyboard.press("Escape"); await p.waitForTimeout(200); }
const madrid3 = ["rep-madrid-sierra-column", "rep-wad-ras-1", "rep-covadonga-4"];
const outOfReach = () => `<h4>Galicia <small>Out of reach this turn</small></h4>
  <p style="margin:0">Two territories away, through enemy-held Castilla y León.</p>
  <ul><li><svg class="m3b-ic" viewBox="0 0 24 24"><path d="M7 3h5v9l7 3v4H5v-4l2-3z"/></svg><span><b>March</b> reaches one territory a turn: 2 turns, once Castilla y León is yours.</span></li>
  <li><svg class="m3b-ic" viewBox="0 0 24 24"><path d="M2 6h12v10H2zM14 9h4l3 3v4h-7z"/></svg><span><b>Motor</b> can't cross the Piedrafita pass into Lugo.</span></li>
  <li><svg class="m3b-ic" viewBox="0 0 24 24"><path d="M8 3 6 21M16 3l2 18M7 7h10M6.5 12h11M6 17h12"/></svg><span><b>Rail</b> runs through León, which you don't hold.</span></li></ul>`;
async function lastTurnSetup(p) {
  await start(p, { through: "resolution2" });
  await inject(p);
  const r = p.getByRole("button", { name: "Turn report", exact: true });
  if (await r.isVisible().catch(() => false)) await r.click();
  await B(p, "harvestReport");
  await D(p, "game/startNextTurn");
  await waitForMap(p);
  await B(p, "chrome", { active: "last" });
}
async function routesCompose(p, file) {
  await start(p); await hidePane(p);
  await inject(p);
  const km = await p.evaluate(() => { const e = window.__M3.entries; const a = e.zaragoza.capital, b = e.murcia.capital, c = e.barcelona.capital; return { x: (a.x + b.x + c.x) / 3 - 20, y: (a.y + b.y) / 2 }; });
  await zoomOn(p, km.x, km.y, 2);
  const box = await p.evaluate(() => { const r = document.querySelector(".map-surface").getBoundingClientRect(); return { cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 }; });
  const clip = { x: Math.round(box.cx - 355), y: Math.round(box.cy - 320), width: 710, height: 640 };
  await p.mouse.move(2, 2);
  const left = await p.screenshot({ clip });
  await p.evaluate(() => document.body.classList.add("m3b-hide-routes"));
  await B(p, "roads");
  await B(p, "route", ["barcelona", "lleida", "zaragoza"], { mode: "Rail", label: "Rail · Durruti Column" });
  await B(p, "route", ["valencia", "alicante", "murcia"], { mode: "Motor", label: "Motor · Militia column" });
  await p.waitForTimeout(250);
  const right = await p.screenshot({ clip });
  const head = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="800">
    <rect width="1440" height="800" fill="#e9e1cf"/>
    <text x="16" y="44" font-family="Iowan Old Style, Palatino, Georgia, serif" font-size="26" font-weight="700" fill="#241d18">Today: curved arrow</text>
    <text x="16" y="70" font-family="Inter, Helvetica, Arial, sans-serif" font-size="15" fill="#5b4d40">A quadratic curve from territory to territory; it says nothing about how the units travel.</text>
    <text x="736" y="44" font-family="Iowan Old Style, Palatino, Georgia, serif" font-size="26" font-weight="700" fill="#241d18">Routed along the network</text>
    <text x="736" y="70" font-family="Inter, Helvetica, Arial, sans-serif" font-size="15" fill="#5b4d40">The order line follows the drawn rail and road links. Roads faint (main thicker); chevrons mark passes.</text>
    <rect x="15" y="135" width="712" height="642" fill="none" stroke="#241d18" stroke-width="2"/>
    <rect x="713" y="135" width="712" height="642" fill="none" stroke="#241d18" stroke-width="2"/>
  </svg>`);
  await sharp(head).composite([{ input: left, left: 16, top: 136 }, { input: right, left: 714, top: 136 }]).png().toFile(file);
}
Object.assign(shots, {
  "b-topbar": { title: "New top bar; pane on This turn with a selection footer", run: async (p) => { await start(p); await inject(p); await select(p, "madrid"); await B(p, "chrome"); await pick(p, "madrid", madrid3); await B(p, "thisTurn", await p.evaluate(() => window.M3B.actionBar({ count: 3, where: "Madrid" }))); } },
  "b-menu": { title: "Hamburger menu", run: async (p) => { await start(p); await inject(p); await deselect(p); await B(p, "chrome"); await B(p, "thisTurn"); await B(p, "menu"); } },
  "b-context-desktop": { title: "Right-click quick actions", run: async (p) => { await start(p); await inject(p); await deselect(p); await B(p, "chrome"); await B(p, "thisTurn"); await B(p, "contextMenu", "badajoz", "extremadura"); } },
  "b-context-phone": { phone: true, title: "Phone: long-press wheel", run: async (p) => { await start(p); await hidePane(p); await inject(p); await B(p, "chrome"); await B(p, "radial", "badajoz", "extremadura"); } },
  "b-invade": { title: "Invade Castilla y León", run: async (p) => { await start(p); await inject(p); await select(p, "madrid"); await B(p, "chrome"); await B(p, "invade"); await B(p, "scrollUnder", ".m3b-cards .m3b-card:nth-child(2)"); } },
  "b-reinforce": { title: "Reinforce Valencia", run: async (p) => { await start(p); await inject(p); await select(p, "madrid"); await B(p, "chrome"); await B(p, "reinforce"); await B(p, "scrollUnder", ".m3b-group h4"); } },
  "b-unreachable-hover": { title: "Hover an unreachable territory while moving", run: async (p) => { await start(p); await inject(p); await select(p, "madrid"); await B(p, "chrome"); await pick(p, "madrid", madrid3, "move"); await B(p, "thisTurn", await p.evaluate(() => window.M3B.actionBar({ count: 3, where: "Madrid", hint: "Move: pick a destination on the map. Hover a dimmed territory to see why it's out of reach." }))); await B(p, "unreachable", "lugo", "galicia", outOfReach(false)); } },
  "b-unreachable-phone": { phone: true, title: "Phone: tapped an unreachable territory", run: async (p) => { await start(p); await inject(p); await B(p, "chrome"); await pick(p, "madrid", madrid3, "move"); await hidePane(p); await B(p, "unreachable", "lugo", "galicia", outOfReach(true), { phone: true }); } },
  "b-global-recruitment": { title: "Global Recruitment view", run: async (p) => { await start(p); await inject(p); await deselect(p); await B(p, "chrome", { active: "recruit" }); await B(p, "globalRecruitment"); } },
  "b-global-building": { title: "Global Building view", run: async (p) => { await start(p); await inject(p); await deselect(p); await B(p, "chrome", { active: "build" }); await B(p, "globalBuilding"); } },
  "b-ledger": { title: "Funds ledger: one flat list", run: async (p) => { await start(p); await inject(p); await deselect(p); await B(p, "chrome"); await B(p, "thisTurn"); await chip(p, "Funds"); await B(p, "ledger"); } },
  "b-air-battle": { title: "Air battle before the ground battle", run: async (p) => { await lastTurnSetup(p); await B(p, "lastTurn", { air: true, turn: 3 }); } },
  "b-last-turn": { title: "Last turn view during planning", run: async (p) => { await lastTurnSetup(p); await B(p, "lastTurn", { turn: 3 }); } },
  "b-routes": { title: "Curved arrows vs routed lines", custom: routesCompose, run: async () => {} }
});

const wanted = process.argv.slice(2);
await mkdir(out, { recursive: true });
await mkdir(images, { recursive: true });
const browser = await chromium.launch();
for (const [id, s] of Object.entries(shots)) {
  if (wanted.length && !wanted.some((w) => id === w || (w.endsWith("*") && id.startsWith(w.slice(0, -1))))) continue;
  const ctx = await browser.newContext(s.phone ? { ...devices["Pixel 7"] } : { viewport: { width: 1440, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    if (s.custom) {
      const file = join(out, `${id}.png`);
      await s.custom(page, file);
      await sharp(file).resize({ width: 1440 }).webp({ quality: 82 }).toFile(join(images, `r2-${id}.webp`));
      console.log(`ok   ${id}${errors.length ? "  page errors: " + errors.join(" | ") : ""}`);
      await ctx.close();
      continue;
    }
    await s.run(page);
    await page.evaluate(() => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
    if (!s.keepMouse) await page.mouse.move(2, 2);
    await page.waitForTimeout(250);
    const file = join(out, `${id}.png`);
    await page.screenshot({ path: file });
    await sharp(file).resize({ width: s.phone ? 540 : 1440 }).webp({ quality: 82 }).toFile(join(images, `r2-${id}.webp`));
    console.log(`ok   ${id}${errors.length ? "  page errors: " + errors.join(" | ") : ""}`);
  } catch (e) {
    console.log(`FAIL ${id}: ${e.message.split("\n")[0]}`);
  }
  await ctx.close();
}
await browser.close();
