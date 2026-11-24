// Note 8: the Invade pane. Measures visible unit cards before and after each option, in the live DOM.
import { browser, newPage, start, openView, shot, sheet, css } from "./lib.mjs";
import { readFile } from "node:fs/promises";
const sc = JSON.parse(await readFile(new URL("../../../../src/scenarios/spanish-civil-war-1936/scenario.json", import.meta.url), "utf8"));
const NAMES = Object.fromEntries(sc.units.map((u) => [u.id, u.name]));
const unstick = ".muster-box{position:static!important}";
const mini = `.m3-mini{position:sticky;top:0;z-index:3;display:flex;gap:.55rem;align-items:center;min-height:38px;margin:0 -.2rem;padding:.2rem .65rem;border:1px solid var(--rule);border-left:4px solid var(--end-turn);border-radius:8px;background:var(--paper);box-shadow:0 3px 8px rgb(36 29 24/14%);font-size:.84rem;white-space:nowrap}
.m3-mini b{font:700 1.02rem var(--serif)} .m3-mini .tone{margin-left:auto;font-weight:750}
.m3-mini button{border:0;background:none;color:var(--route);font:650 .78rem var(--sans);text-decoration:underline;padding:.3rem 0;min-height:0}
.m3-def{border:1px solid var(--rule);border-radius:8px;background:rgb(255 255 255/45%);font-size:.82rem}
.m3-tabs{display:grid;grid-template-columns:1fr 1fr;padding:2px;border:1px solid var(--rule);border-radius:999px}.m3-tabs button{min-height:34px;border:0;border-radius:999px;background:transparent;color:var(--ink-soft);font:650 .82rem var(--sans)}.m3-tabs [data-on]{background:var(--ink);color:var(--paper)}.m3-def summary{padding:.5rem .65rem;cursor:pointer;font-weight:650;list-style-position:inside} .m3-def ul{margin:0;padding:0 .65rem .55rem 1.6rem} `;
const compact = `.muster-card{grid-template-columns:minmax(0,1fr) auto;column-gap:.5rem;row-gap:.2rem;padding:.4rem .6rem!important}
.muster-card-head{grid-column:1;min-width:0}.muster-card-name{font-size:.94rem!important;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.muster-card-type{display:none}.muster-card-figures{grid-column:1/-1;grid-row:2;flex-wrap:nowrap!important;gap:.4rem!important;padding-left:26px;align-items:center;min-width:0}
.muster-card .muster-values{font-size:1rem}.muster-strength{width:36px!important;flex:none}.muster-men{white-space:nowrap;font-size:.76rem}
.muster-modes{grid-column:2;grid-row:1;flex-wrap:nowrap!important;gap:.2rem!important}
.muster-group{gap:.3rem!important}.muster-card{row-gap:0!important;padding:.22rem .55rem!important}.muster-card-head{min-height:28px}.muster-modes .muster-chip{padding:0 .4rem;font-size:.72rem;min-height:26px;height:26px}.muster-dug-in{padding:0 .4rem!important;font-size:.7rem!important}.muster-modes .muster-chip:disabled{display:none}
.muster-mode-notes,.muster-card>.muster-note:not(.muster-replaces){display:none!important}
.m3-why{font-size:.76rem;color:var(--ink-soft);margin:-.2rem 0 0}.muster-aircraft .muster-card-type{display:block;grid-column:1/-1}`;
const tall = `.campaign-map[data-pane-layout="sheet"] .map-pane[data-open="true"]{max-height:86%!important}`;
async function open(page, sel = "all") {
  await page.evaluate(() => window.__store.dispatch({ type: "pane/resetPane" }));
  await openView(page, { kind: "invade", target: "andalucia" });
  await page.waitForTimeout(250);
  const names = await page.locator(".muster-group:not(.muster-support) .muster-card input").count();
  for (let i = 0; i < names; i += 1) { const b = page.locator(".muster-group:not(.muster-support) .muster-card input").nth(i); if (!(await b.isChecked())) await b.evaluate((e) => e.click()); }
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelector(".map-pane-body").scrollTop = 0; });
}

const page_build = ({ withMini, details, compactCards, tabs, NAMES }) => {
  const box = document.querySelector(".muster-box");
  const dd = [...box.querySelectorAll(".muster-box-facts dd")].map((e) => e.textContent);
  const nums = [...box.querySelectorAll(".muster-box-numbers strong")].map((e) => e.textContent);
  const st = window.M3D.S().game.state; // unit names contain commas and "and", so never split the list text
  const names = Object.values(st.units).filter((u) => u.territoryId === "andalucia" && u.factionId !== "republic").map((u) => st.raised[u.id]?.name ?? NAMES[u.id]).filter((nm) => nm && dd[2].includes(nm));
  window.__defs = [names.length, dd[2]];
  const n = names.length;
  // Today's box keeps its numbers and facts, but not the list of names.
  const def = [...box.querySelectorAll(".muster-box-facts > div")].find((d) => d.querySelector("dt").textContent === "Defenders");
  if (details) {
    def.remove();
    const el = document.createElement("details"); el.className = "m3-def";
    el.innerHTML = `<summary>${n} defenders: ${names.slice(0, 2).join(", ")} and ${n - 2} more</summary><ul>${names.map((x) => `<li>${x}</li>`).join("")}</ul>`;
    box.after(el);
  }
  if (compactCards) for (const g of document.querySelectorAll(".muster-group:not(.muster-support)")) {
    const seen = new Set(); for (const li of g.querySelectorAll(".muster-mode-notes li")) seen.add(li.textContent);
    if (!seen.size) continue;
    const p = document.createElement("p"); p.className = "m3-why"; p.innerHTML = `Rail is the only way today. <u>Why not March or Motor?</u>`;
    const open = [...new Set([...g.querySelectorAll(".muster-mode:not(:disabled)")].map((e) => e.textContent.trim()))];
    const shut = [...new Set([...g.querySelectorAll(".muster-mode:disabled")].map((e) => e.textContent.trim()))];
    p.innerHTML = `Only ${open.join(" or ")} reaches it. <u>Why not ${shut.join(" or ")}?</u>`;
    g.querySelector(".muster-group-title").after(p);
  }
  if (tabs) {
    const d = document.querySelector(".m3-def"); const t = document.createElement("div"); t.className = "m3-tabs";
    t.innerHTML = `<button data-on="true">Your units (10)</button><button>Defenders (${n})</button>`; d.replaceWith(t);
  }
  if (withMini) {
    const m = document.createElement("div"); m.className = "m3-mini"; m.setAttribute("role", "status");
    m.innerHTML = `<span>Attack <b>${nums[0]}</b></span><span>Defence <b>${nums[1]}</b></span><span>${dd[0]}</span><span class="tone">${dd[1]} to take it</span>`;
    box.before(m);
    if (details) box.style.display = "none";
  }
};
const rows = [];
async function run(kind, name, { styles = "", mini: wm = false, details = false, tallSheet = false, scroll = 0, tabs = false }) {
  const page = await newPage(kind);
  await start(page, { orders2: false });
  await page.evaluate(() => { window.M3D.d("game/endTurn"); window.M3D.d("game/startNextTurn"); });
  await page.waitForTimeout(400);
  await open(page);
  if (tallSheet) await css(page, tall);
  await css(page, styles + (wm ? mini : "") );
  if (details || wm) await page.evaluate(page_build, { withMini: wm, details, compactCards: styles.includes('m3-why'), tabs, NAMES });
  await page.waitForTimeout(250);
  await page.evaluate(() => { document.querySelector(".map-pane-body").scrollTop = 0; });
  const top = await measureWith(page, wm);
  await page.evaluate(() => { document.querySelector(".map-pane-body").scrollTop = 500; });
  const mid = await measureWith(page, wm);
  rows.push({ kind, name, n: top.cards, boxH: top.box, miniH: top.mini, body: top.body, room0: top.room, full0: top.full, half0: top.half, room500: mid.room, full500: mid.full, half500: mid.half, cardH: top.cardH });
  const defs = await page.evaluate(() => window.__defs ?? null); if (defs && !globalThis.__said) { globalThis.__said = 1; console.log("DEFENDERS", defs[0], defs[1]); }
  if (scroll === 0) await page.evaluate(() => { document.querySelector(".map-pane-body").scrollTop = 0; });
  await page.waitForTimeout(150);
  await shot(page, `8-${name}-${kind}`, kind === "phone" ? {} : { clip: { x: 900, y: 0, width: 540, height: 800 } });
  await page.context().close();
}
const measureWith = (page, wm) => page.evaluate(() => {
  const body = document.querySelector(".map-pane-body"), b = body.getBoundingClientRect();
  const box = document.querySelector(".muster-box"), bx = box.getBoundingClientRect();
  const mini = document.querySelector(".m3-mini")?.getBoundingClientRect();
  const foot = document.querySelector(".muster-footer").getBoundingClientRect();
  const stuck = getComputedStyle(box).position === "sticky" && getComputedStyle(box).display !== "none";
  const top = Math.max(b.top, stuck ? bx.bottom : b.top, mini ? mini.bottom : b.top), bot = Math.min(b.bottom, foot.top);
  const cards = [...document.querySelectorAll(".muster-group .muster-card")];
  const vis = cards.map((c) => { const r = c.getBoundingClientRect(); return Math.max(0, Math.min(r.bottom, bot) - Math.max(r.top, top)) / r.height; });
  return { body: Math.round(b.height), box: Math.round(bx.height), mini: mini ? Math.round(mini.height) : 0, room: Math.round(bot - top), cardH: cards.slice(0, 10).map((c) => Math.round(c.getBoundingClientRect().height)).join(), cards: cards.length, full: vis.filter((v) => v > 0.97).length, half: vis.filter((v) => v > 0.5).length };
});
for (const kind of ["desktop", "phone"]) {
  await run(kind, "before", {});
  await run(kind, "unstuck-only", { styles: unstick });
  await run(kind, "a-recommended", { styles: unstick + compact, mini: true, details: true, tallSheet: true });
  await run(kind, "b-scroll", { styles: unstick + compact, details: true, tallSheet: true });
  await run(kind, "c-tabs", { styles: unstick + compact, mini: true, details: true, tabs: true, tallSheet: true });
}
console.table(rows);
await sheet("8-invade-before", [{ src: "8-before-desktop", caption: "Before, desktop: 0 of 12 unit cards visible" }, { src: "8-before-phone", caption: "Before, phone: 0 of 12" }], { height: 800 });
await sheet("8-invade-recommended", [{ src: "8-a-recommended-desktop", caption: "A (recommended), desktop" }, { src: "8-a-recommended-phone", caption: "A (recommended), phone" }], { height: 800 });
await sheet("8-invade-options", [{ src: "8-b-scroll-desktop", caption: "B. Everything scrolls" }, { src: "8-c-tabs-desktop", caption: "C. Two tabs" }], { height: 800 });
await browser.close();
