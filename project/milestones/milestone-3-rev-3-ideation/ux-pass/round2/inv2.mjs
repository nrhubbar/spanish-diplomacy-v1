// Item 8: the Invade pane with everything scrolling. Numbers come from the app's own estimate.
import { browser, newPage, start, openView, css, shot, sheet, sc } from "./lib2.mjs";
import { engine } from "./engine.mjs";
const GENS = Object.fromEntries(sc.generals.roster.map((g) => [g.id, g.name]));
const CSS = `.muster-box{position:static!important}.muster-footer{position:static!important;background:none!important;padding:0!important}
.muster-card{grid-template-columns:minmax(0,1fr) auto;column-gap:.5rem;row-gap:0!important;padding:.22rem .55rem!important}
.muster-card-head{grid-column:1;min-width:0;min-height:28px}.muster-card-name{font-size:.94rem!important;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.muster-card-type{display:none}.muster-card-figures{grid-column:1/-1;grid-row:2;flex-wrap:nowrap!important;gap:.4rem!important;padding-left:26px;align-items:center;min-width:0}
.muster-card .muster-values{font-size:1rem}.muster-strength{width:36px!important;flex:none}.muster-men{white-space:nowrap;font-size:.76rem}
.muster-modes{grid-column:2;grid-row:1;flex-wrap:nowrap!important;gap:.2rem!important}.muster-group{gap:.3rem!important}
.muster-modes .muster-chip{padding:0 .4rem;font-size:.72rem;min-height:26px;height:26px}.muster-dug-in{padding:0 .4rem!important;font-size:.7rem!important}.muster-modes .muster-chip:disabled{display:none}
.muster-mode-notes,.muster-card>.muster-note:not(.muster-replaces){display:none!important}.m3-why{font-size:.76rem;color:var(--ink-soft);margin:-.2rem 0 0}.muster-aircraft .muster-card-type{display:block;grid-column:1/-1;padding-left:26px}
.m3-def .muster-card-figures{padding-left:0}.m3-def .muster-card{grid-template-columns:minmax(0,1fr)}.m3-def .muster-card-head{cursor:default}
.m3-led h5{margin:.1rem 0 .1rem;font:750 .82rem var(--sans)}.m3-led table{width:100%;border-collapse:collapse;font-size:.82rem;font-variant-numeric:tabular-nums}.m3-led th{font-weight:400;text-align:left;padding:.1rem 0;border-bottom:1px solid var(--paper-deep)}.m3-led td{text-align:right;font-weight:800;padding:.1rem 0;border-bottom:1px solid var(--paper-deep)}.m3-led .pos{color:#276221}.m3-led .neg{color:#9a2f14}.m3-led tfoot th,.m3-led tfoot td{font-weight:800;border-bottom:0;border-top:1.5px solid var(--ink)}.m3-led p{margin:.2rem 0 0;color:var(--ink-soft);font-size:.76rem;line-height:1.3}
.muster-box-facts{align-items:start}.muster-box-facts .m3-info{margin-left:auto}.muster-box{gap:.3rem!important}@media(width<=720px){.muster-box-facts{column-gap:.8rem!important}.m3-info{font-size:.76rem!important}.m3-led p{font-size:.72rem}}.map-pane-panel{min-width:0}.m3-grip{position:absolute;left:-9px;top:0;bottom:0;width:18px;cursor:col-resize;display:grid;place-items:center;z-index:3}.m3-grip::after{content:"";width:5px;height:64px;border-radius:3px;background:var(--ink);opacity:.6}
.m3-sheetgrip{position:absolute;left:50%;top:2px;width:64px;height:20px;margin-left:-32px;display:grid;place-items:center;z-index:3}.m3-sheetgrip::after{content:"";width:44px;height:5px;border-radius:3px;background:var(--ink);opacity:.5}
.map-pane-toggle{padding:0 .6rem!important;min-width:36px}.map-pane-toggle>span:last-child{display:none}
.m3-order{min-height:40px;padding:0 .8rem!important;width:auto!important;font-size:.86rem!important;white-space:nowrap}.m3-order.full{white-space:normal!important;width:100%!important;font-size:1rem!important}
.map-pane-header.m3-h{display:grid!important;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:0 .6rem}.m3-h .map-pane-heading{display:contents}.m3-h .map-pane-back{grid-column:1;grid-row:1;justify-self:start}.m3-h .map-pane-toggle{grid-column:2;grid-row:1;position:static!important;justify-self:end}.m3-h .map-pane-title{grid-column:1;grid-row:2;margin:0}.m3-h .m3-order{grid-column:2;grid-row:2}.m3-h.m3-narrow .m3-order{grid-column:1/-1;grid-row:3;justify-self:stretch;margin-top:.35rem}
.m3-h .map-pane-bar-action{grid-column:2;grid-row:2}
.m3-count{position:absolute;top:-15px;right:-12px;padding:1px 4px;border:1.5px solid var(--paper);border-radius:8px;color:var(--ink);background:var(--gold);font-size:11px;font-weight:800;line-height:1.1;white-space:nowrap}`;
const build = ({ place, GENS, narrow, phone }) => {
  const E = window.__eng, S = window.__sc, st = window.M3D.S().game.state;
  const v = E.muster(S, st, "republic", "andalucia", "invade", { airOrders: [], orders: [] });
  const ids = v.groups.flatMap((g) => g.cards.map((c) => c.unitId)), air = v.support.map((x) => x.unitId);
  const est = E.estimateAttack(S, st, "republic", ids, "andalucia", air);
  const nm = (m) => m.kind === "general" ? `${GENS[m.generalId]} commands` : m.kind === "trait" ? `${GENS[m.generalId]} is ${m.traitId.replace(/-/g, " ")}` : m.kind === "air-support" ? `Ground Support, ${m.unitIds.length} aircraft` : m.kind === "dug-in" ? `Dug in, level ${m.level}` : E.modifierName(m, S);
  const total = est.modifiers.reduce((s, m) => s + m.roll, 0);
  const box = document.querySelector(".muster-odds");
  const facts = box.querySelectorAll(".muster-box-facts > div"); facts[2].querySelector("dd").textContent = `${est.defender.armies.length} units`;
  box.querySelectorAll(".muster-box-line").forEach((e) => e.remove());
  const led = document.createElement("div"); led.className = "m3-led";
  led.innerHTML = `<h5>Effects on the roll:</h5><table><tbody>${est.modifiers.map((m) => `<tr><th scope="row">${nm(m)}</th><td class="${m.roll > 0 ? "pos" : "neg"}">${E.signed(m.roll)}</td></tr>`).join("")}</tbody><tfoot><tr><th scope="row">Total known now</th><td>${E.signed(total)}</td></tr></tfoot></table><p>Not known yet: the die, their moves, and whether their aircraft fly.</p>`;
  const info = box.lastElementChild; box.querySelector(".muster-box-facts").append(info); info.classList.add("m3-info"); box.append(led);
  // Compact cards: one reason line a group (round 1).
  for (const g of document.querySelectorAll(".muster-group:not(.muster-support):not(.muster-here)")) {
    const open = [...new Set([...g.querySelectorAll(".muster-mode:not(:disabled)")].map((e) => e.textContent.trim()))], shut = [...new Set([...g.querySelectorAll(".muster-mode:disabled")].map((e) => e.textContent.trim()))].filter((x) => !open.includes(x));
    if (!shut.length) continue;
    const p = document.createElement("p"); p.className = "m3-why"; p.innerHTML = `Only ${open.join(" or ")} reaches it. <u>Why not ${shut.join(" or ")}?</u>`; g.querySelector(".muster-group-title").after(p);
  }
  // Defenders: the attacker's own card, less the tick box and travel chips.
  const defs = est.defender.armies.map((a) => st.units[a.unitId]).map((u) => ({ u, f: E.armyFigures(S, st, u), name: st.raised[u.id]?.name ?? S.index.units.get(u.id).name })).sort((p, q) => q.f.defence - p.f.defence);
  const sec = document.createElement("section"); sec.className = "muster-group m3-def";
  sec.innerHTML = `<h3 class="muster-group-title"><span>Defenders</span><span class="muster-group-count">${defs.length} units, ${est.defender.value} defence</span></h3>` + defs.map(({ u, f, name }) => `<article class="muster-card"><span class="muster-card-head"><span class="muster-card-name">${name}</span></span><div class="muster-card-figures"><span class="muster-values">${E.valuesLabel(f.attack, f.defence)}</span><span class="muster-strength"><span style="width:${Math.round(E.strengthShare(f) * 100)}%"></span></span><span class="muster-men">${E.menLabel(f)} men</span>${u.morale.demoralized ? '<span class="muster-chip muster-dug-in">Demoralized</span>' : ""}${/Headquarters/.test(name) ? '<span class="muster-chip muster-dug-in">General</span>' : ""}</div></article>`).join("");
  const foot = document.querySelector(".muster-footer"), btn = foot.querySelector("button"); foot.before(sec);
  btn.classList.add("m3-order"); const full = btn.textContent.trim(); btn.setAttribute("aria-label", full);
  const header = document.querySelector(".map-pane-header"); header.classList.add("m3-h"); header.classList.toggle("m3-narrow", !!narrow);
  if (place === "a") { sec.before(foot); btn.classList.add("full"); }
  if (place === "c") { box.append(foot); btn.classList.add("full"); }
  if (place === "b") { const svg = btn.querySelector("svg").outerHTML; btn.innerHTML = svg + (narrow ? full : `Order ${ids.length} units`); if (phone) header.querySelector(".map-pane-bar-action").style.display = "none"; header.append(btn); foot.remove(); }
  if (phone && place !== "b") { /* End Turn stays in the sheet's header, as today */ }
  const grip = document.createElement("div"); grip.className = phone ? "m3-sheetgrip" : "m3-grip"; grip.setAttribute("role", "separator"); document.querySelector(".map-pane").append(grip);
  // The map: the single-region view's own selected class on every ticked unit; a group says how many.
  const ticked = new Set(ids), air2 = new Set(air), by = {};
  for (const id of ids) (by[st.units[id].territoryId] ??= []).push(id);
  const tn = (t) => S.index.territories.get(t).name; const left = { ...by };
  for (const c of document.querySelectorAll(".unit-counter")) {
    const id = c.dataset.unitId; if (id && ticked.has(id)) { c.dataset.selected = "true"; continue; }
    if (!c.classList.contains("unit-counter-group")) continue;
    const label = c.querySelector(".visually-hidden").textContent; const t = Object.keys(left).find((k) => label.startsWith("Republican Government") && label.includes(` units in ${tn(k)},`)); if (!t) continue;
    c.dataset.selected = "true"; const n = Number(c.dataset.count); const cnt = c.querySelector(".unit-counter-count"); cnt.className = "m3-count"; cnt.textContent = `${by[t].length} of ${n}`;
  }
  for (const c of document.querySelectorAll(".air-counter")) if (air2.has(c.dataset.unitId)) c.dataset.selected = "true";
  return { full, total, mods: est.modifiers.map((m) => [nm(m), m.roll]), take: est.takeChance, defs: defs.length, defSum: est.defender.value, by: Object.fromEntries(Object.entries(by).map(([k, x]) => [k, x.length])), selected: document.querySelectorAll('.unit-counter[data-selected="true"]').length };
};
const measure = (page) => page.evaluate(() => {
  const b = document.querySelector(".map-pane-body").getBoundingClientRect();
  const full = (sel) => [...document.querySelectorAll(sel)].map((c) => { const r = c.getBoundingClientRect(); return Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top)) / r.height; });
  const n = (a) => `${a.filter((x) => x > .97).length}; ${a.filter((x) => x > .5).length}`;
  const y = full(".muster-group:not(.m3-def) .muster-card"), d = full(".m3-def .muster-card");
  const ob = document.querySelector(".m3-order").getBoundingClientRect(), hb = document.querySelector(".map-pane-header").getBoundingClientRect();
  const inHeader = !!document.querySelector(".m3-order").closest(".map-pane-header");
  return { yours: n(y), defs: n(d), body: Math.round(b.height), header: Math.round(hb.height), box: Math.round(document.querySelector(".muster-odds").getBoundingClientRect().height), cardH: Math.round(document.querySelector(".muster-card").getBoundingClientRect().height), defH: Math.round(document.querySelector(".m3-def .muster-card").getBoundingClientRect().height), orderVisible: inHeader || (ob.top >= b.top && ob.bottom <= b.bottom + 1), scrollH: document.querySelector(".map-pane-body").scrollHeight, over: document.querySelector(".map-pane-body").scrollWidth - document.querySelector(".map-pane-body").clientWidth };
});
async function run(kind, place, name, { width, tall = kind === "phone", scrolls = [0, 500, "page", "end"], clips = [0] } = {}) {
  const page = await newPage(kind); await start(page, { orders2: false });
  await page.evaluate(() => { window.M3D.d("game/endTurn"); window.M3D.d("game/startNextTurn"); }); await page.waitForTimeout(400);
  await openView(page, { kind: "invade", target: "andalucia" }); await page.waitForTimeout(300);
  for (let i = 0, n = await page.locator(".muster-card input").count(); i < n; i += 1) { const b = page.locator(".muster-card input").nth(i); if (!(await b.isChecked())) await b.evaluate((e) => e.click()); }
  await page.waitForTimeout(250); await engine(page); await css(page, CSS + (width ? `.map-pane{width:${width}px!important}` : "") + (tall ? `.campaign-map[data-pane-layout="sheet"] .map-pane[data-open="true"]{max-height:86%!important}` : ""));
  const info = await page.evaluate(build, { place, GENS, narrow: width !== undefined && width < 360, phone: kind === "phone" });
  await page.waitForTimeout(300);
  for (const s of scrolls) {
    await page.evaluate((v) => { const b = document.querySelector(".map-pane-body"); if (v === "btn") { b.scrollTop = 0; const o = document.querySelector(".m3-order").getBoundingClientRect(); b.scrollTop = o.top - b.getBoundingClientRect().top - 260; return; } b.scrollTop = v === "page" ? b.clientHeight : v === "end" ? b.scrollHeight : v; }, s); await page.waitForTimeout(80);
    console.log(kind, place, width ?? "", s, JSON.stringify(await measure(page)));
    if (clips.includes(s)) await shot(page, `8-${name}-${s}`, kind === "phone" ? {} : { clip: name.startsWith("full") && s === 0 ? { x: 250, y: 100, width: 1180, height: 700 } : { x: 985, y: 100, width: 445, height: 700 } });
  }
  if (name.startsWith("full")) console.log(JSON.stringify(info));
  await page.context().close();
}
const only = process.argv[2];
if (!only || only === "main") {
  await run("desktop", "b", "full", { clips: [0, 500] });
  await sheet("8-invade", [{ src: "8-full-0", caption: ["Top of the pane: ticked units glow on the map", "Andalucía, turn 3. The grip on the pane's left edge resizes it."] }, { src: "8-full-500", caption: ["After one scroll of 500 px"] }], { gap: 20, maxWidth: 1600 });
}
if (!only || only === "phone") {
  await run("phone", "b", "phone", { clips: [0, 500] });
  await sheet("8-invade-phone", [{ src: "8-phone-0", caption: "Top, sheet at 86%" }, { src: "8-phone-500", caption: "After one scroll of 500 px" }], { scale: 1, height: 1000 });
}
if (only === "more") { await run("desktop", "b", "x", { width: 320, scrolls: [0, 500], clips: [] }); await run("desktop", "a", "y", { scrolls: [0, 500], clips: [] }); await run("desktop", "c", "z", { scrolls: [0, 500], clips: [] }); }
if (!only || only === "btn") {
  await run("desktop", "a", "btn-a", { scrolls: [0, "btn"], clips: ["btn"] }); await run("desktop", "b", "btn-b", { scrolls: [500], clips: [500] }); await run("desktop", "c", "btn-c", { scrolls: [0], clips: [0] });
  await run("phone", "b", "p46", { tall: false, scrolls: [0, 500], clips: [] }); await run("phone", "c", "pc", { scrolls: [0], clips: [] });
  await sheet("8-order-button", [{ src: "8-btn-a-btn", caption: ["(a) After the units, before the defenders", "Scrolled down to it"] }, { src: "8-btn-b-500", caption: ["(b) In the header row (recommended)", "Scrolled 500 px: still in reach, nothing covered"] }, { src: "8-btn-c-0", caption: ["(c) At the bottom of the odds card", "Scrolls away with the odds"] }], { gap: 24, maxWidth: 1500 });
}
await browser.close();
