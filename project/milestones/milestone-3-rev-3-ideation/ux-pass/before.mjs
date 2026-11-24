import { browser, newPage, start, openView, shot, waitForMap } from "./lib.mjs";
export async function zoomTo(page, sel, steps) {
  const surface = page.locator(".map-surface");
  await surface.focus(); await page.keyboard.press("0");
  for (let i = 0; i < steps; i += 1) await page.keyboard.press("+");
  await page.waitForTimeout(500);
  for (let pass = 0; pass < 4; pass += 1) {
    const d = await page.evaluate((s) => {
      const e = document.querySelector(s); if (!e) return null;
      const r = e.getBoundingClientRect(), m = document.querySelector(".map-surface").getBoundingClientRect();
      const p = document.querySelector(".map-pane[data-open=true][data-layout=side]")?.getBoundingClientRect();
      return { x: (m.left + (p ? p.left : m.right)) / 2 - (r.left + r.width / 2), y: (m.top + m.bottom) / 2 - (r.top + r.height / 2) };
    }, sel);
    if (!d) return false;
    const ax = Math.round(d.x / 60), ay = Math.round(d.y / 60);
    if (!ax && !ay) break;
    for (let i = 0; i < Math.abs(ax); i += 1) await page.keyboard.press(ax > 0 ? "a" : "d");
    for (let i = 0; i < Math.abs(ay); i += 1) await page.keyboard.press(ay > 0 ? "w" : "s");
    await page.waitForTimeout(350);
  }
  return true;
}
if (process.argv[1].endsWith("before.mjs")) {
  const page = await newPage();
  await start(page);
  console.log(await page.evaluate(() => JSON.stringify([...document.querySelectorAll(".air-counter")].map((e) => [e.dataset.unitId, e.getAttribute("title"), e.dataset.planned, e.querySelector(".air-counter-tag").textContent]))));
  for (const s of [0, 1, 2, 4, 6, 9, 12]) {
    await zoomTo(page, ".air-counter", s);
    const z = await page.evaluate(() => [document.querySelector(".map-surface").dataset.zoom, document.querySelector(".map-surface").dataset.semanticLevel].join());
    console.log(s, z);
    if ([0, 2, 6, 12].includes(s)) await shot(page, `before-air-${s}`, { clip: { x: 250, y: 200, width: 560, height: 420 } });
  }
  // header widths
  for (const w of [1440, 1280, 1024, 412]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(400);
    const h = await page.locator(".game-header").boundingBox();
    const pane = await page.evaluate(() => { const p = document.querySelector(".map-pane")?.getBoundingClientRect(), m = document.querySelector(".map-surface").getBoundingClientRect(); return { pane: Math.round(p.width), map: Math.round(m.width), mapH: Math.round(m.height) }; });
    console.log("header", w, Math.round(h.height), JSON.stringify(pane));
    await shot(page, `before-header-${w}`, { clip: { x: 0, y: 0, width: w, height: Math.ceil(h.height) } });
  }
  await page.setViewportSize({ width: 1440, height: 800 });
  await openView(page, { kind: "recruit", territory: "madrid" });
  await page.waitForTimeout(400);
  await shot(page, "before-recruit", { locator: ".map-pane" });
  for (const pane of [320, 300]) {
    await page.evaluate((w) => document.querySelector(".campaign-map").style.setProperty("--pane-width", `${w}px`), pane);
    await page.waitForTimeout(200);
    console.log("recruit overflow", pane, await page.evaluate(() => JSON.stringify([...document.querySelectorAll(".recruit-row")].map((r) => { const n = r.querySelector(".recruit-name"); const m = r.querySelector(".recruit-meta"); return [n.textContent, Math.round(r.getBoundingClientRect().height), r.scrollWidth - r.clientWidth, Math.round(n.getBoundingClientRect().height)]; }))));
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await page.waitForTimeout(300);
  await shot(page, "before-recruit-large", { locator: ".map-pane" });
  console.log("large", await page.evaluate(() => { const b = document.querySelector(".map-pane-body"); return JSON.stringify({ sw: b.scrollWidth, cw: b.clientWidth, rows: [...document.querySelectorAll(".recruit-row")].map((r) => r.scrollWidth - r.clientWidth) }); }));
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; document.querySelector(".campaign-map").style.removeProperty("--pane-width"); });
  // resolution
  await page.evaluate(() => { window.M3D.d("game/endTurn"); });
  await waitForMap(page);
  await page.waitForTimeout(400);
  const cards = await page.evaluate(() => JSON.stringify(window.M3D.S().resolution?.outcomes?.filter((o) => o.kind === "battle" || o.kind === "air-battle").map((o) => ({ k: o.kind, site: o.site, a: o.attackerFactionId, die: o.die, mods: o.modifiers, score: o.score, odds: o.oddsLabel, grade: o.grade, av: o.attacker?.value, dv: o.defender?.value }))));
  console.log((cards ?? JSON.stringify(Object.keys(await page.evaluate(() => window.M3D.S())))).slice(0, 3500));
  await shot(page, "before-report");
  await browser.close();
}
