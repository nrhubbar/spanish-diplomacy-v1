// Note 2: aircraft as cards. Uses the app's own .unit-counter classes and real symbols.
import { browser, newPage, start, shot, sheet, css } from "./lib.mjs";
import { zoomTo } from "./before.mjs";
const airCss = `
.air-layer-mock .air-counter{display:none}
.unit-counter.m3-air .unit-counter-symbol{width:15px;height:10px}
.m3-air-tag{font-size:13px;font-weight:800;letter-spacing:.01em}
.counter-layer[data-level="detail"] .m3-air-tag{font-size:14px;letter-spacing:-.02em}
.m3-air-nums{display:none;font-size:11px;font-weight:650;color:var(--ink-soft);white-space:nowrap;letter-spacing:-.02em}
.counter-layer[data-level="detail"] .m3-air-nums{display:block}
.counter-layer[data-level="overview"] .unit-counter.m3-air .unit-counter-head{display:flex;gap:2px;align-items:center}
.counter-layer[data-level="overview"] .unit-counter.m3-air .unit-counter-symbol{width:13px;height:9px}
.counter-layer[data-level="overview"] .unit-counter.m3-air{padding:1px 2px 6px 5px}
.counter-layer[data-level="overview"] .m3-air-tag{font-size:12px}
.m3-air-range{display:none}
.unit-counter.m3-air[data-grounded="true"]{background:repeating-linear-gradient(135deg,rgb(36 29 24/14%) 0 3px,transparent 3px 7px),color-mix(in srgb,var(--faction-color) 14%,#e9e2d3)}
.m3-ground-badge{position:absolute;left:-8px;bottom:-8px;width:17px;height:17px;border-radius:50%;background:#3d4a56;color:#fff;border:1.5px solid var(--paper);display:grid;place-items:center;font-size:10px;font-weight:800}
.m3-air-count{position:absolute;top:-12px;right:-8px;min-width:19px;padding:1px 3px;border:1.5px solid var(--paper);border-radius:8px;color:var(--paper);background:var(--ink);font-size:11px;font-weight:800;line-height:1;text-align:center}
`;
const info = { fighter: { tag: "FTR", nums: "Air +2", range: "Reach 3", des: "Ni52" }, bomber: { tag: "BOMB", nums: "Supp +3", range: "Reach 4", des: "Ju52" }, recon: { tag: "RCN", nums: "Reach 4", range: "Reach 4", des: "Rec." } };
const page = await newPage();
await start(page);
await css(page, airCss);
await page.evaluate(() => { window.__syms = {}; for (const e of document.querySelectorAll(".air-counter")) { const k = e.querySelector(".air-counter-tag").textContent; const u = e.dataset.unitId; window.__syms[u] = e.querySelector("svg").outerHTML; } window.__ground = document.querySelector(".unit-counter:not(.unit-counter-group)")?.outerHTML; });
await shot(page, "2-before-overview", { clip: { x: 250, y: 250, width: 500, height: 330 } });
// Live: replace the air counters by cards at the same base.
async function liveCards() {
  return page.evaluate(() => {
    const lvl = document.querySelector(".map-surface").dataset.semanticLevel;
    const M = { overview: [32, 24, 2], operational: [54, 39, 4], detail: [58, 56, 4] }[lvl];
    const layer = document.createElement("div"); layer.className = "counter-layer"; layer.dataset.level = lvl; layer.dataset.mock = "1";
    const byBase = {};
    for (const e of document.querySelectorAll(".air-counter")) { const r = e.getBoundingClientRect(); const u = e.dataset.unitId; const k = u.split("-")[0] + Math.round(r.top / 20); (byBase[k] ??= []).push([e, r, u]); }
    const surf = document.querySelector(".map-surface").getBoundingClientRect();
    for (const row of Object.values(byBase)) {
      const ground = [...document.querySelectorAll(".unit-counter")].map((g) => g.getBoundingClientRect());
      const first = row[0][1]; const w = row.length * M[0] + (row.length - 1) * M[2];
      let x = first.left - surf.left + first.width * row.length / 2 - w / 2, y = first.top - surf.top + first.height / 2 - M[1] / 2;
      // keep clear of the army cards: walk up until nothing overlaps
      for (let k = 0; k < 14; k += 1) { const hit = ground.some((g) => g.left - surf.left < x + w && x < g.right - surf.left && g.top - surf.top < y + M[1] && y < g.bottom - surf.top); if (!hit) break; y -= 6; }
      row.forEach(([e, , u], i) => {
        const kind = /ni52/.test(u) ? "fighter" : /recon/.test(u) ? "recon" : "bomber";
        const card = document.createElement("button"); card.className = "unit-counter m3-air"; card.type = "button";
        const col = e.style.getPropertyValue("--faction-color");
        card.style.cssText = `--faction-color:${col};left:${x + i * (M[0] + M[2])}px;top:${y}px;width:${M[0]}px;height:${M[1]}px;--strength-share:1`;
        if (e.dataset.planned === "true") card.dataset.ordered = "true";
        const INF = { fighter: { tag: "FTR", nums: "Air +2", range: "Reach 3", des: "Ni52" }, bomber: { tag: "BOMB", nums: "Supp +3", range: "Reach 4", des: /ju52/.test(u) ? "Ju52" : "Br19" }, recon: { tag: "RCN", nums: "Reach 4", range: "Reach 4", des: "Rec" } }[kind];
        card.innerHTML = `<span class="unit-counter-head"><span class="unit-counter-symbol">${window.__syms[u]}</span>${lvl === "overview" ? `<span class="m3-air-tag">${INF.tag[0]}</span>` : `<span class="unit-counter-designation">${INF.des}</span>`}</span>${lvl === "overview" ? "" : `<span class="m3-air-tag">${INF.tag}</span><span class="m3-air-nums">${INF.nums}</span>`}<span class="unit-counter-bar"></span>${e.dataset.planned === "true" ? `<span class="unit-counter-badge">✓</span>` : ""}`;
        layer.append(card);
      });
    }
    document.querySelector(".air-layer").classList.add("air-layer-mock");
    document.querySelector(".map-surface").append(layer);
    return lvl;
  });
}
const clip = { x: 330, y: 230, width: 440, height: 300 };
for (const [steps, name] of [[0, "overview"], [2, "operational"], [6, "detail"]]) {
  await page.evaluate(() => { document.querySelectorAll("[data-mock]").forEach((e) => e.remove()); document.querySelector(".air-layer")?.classList.remove("air-layer-mock"); });
  await zoomTo(page, '[data-unit-id="rep-ni52-fighters"]', steps);
  await page.waitForTimeout(300);
  await shot(page, `2-before-${name}`, { clip });
  await liveCards();
  await shot(page, `2-a-${name}`, { clip });
}
await sheet("2-air-cards", ["overview", "operational", "detail"].flatMap((z) => [{ src: `2-before-${z}`, caption: `Now, ${z} zoom` }, { src: `2-a-${z}`, caption: `A (recommended), ${z} zoom` }]), { gap: 16, pad: 16, cols: 2 });
// Spec sheet of every state, drawn over the running app with its own counter styles.
await page.evaluate(() => {
  const syms = window.__syms; const rep = "#b1493f", nor = "#b39232", sth = "#665089";
  const ni = syms["rep-ni52-fighters"], br = syms["rep-breguet-bombers"], rc = syms["rep-catalan-recon"], ju = syms["south-ju52-bombers"];
  const base = document.createElement("div"); base.id = "spec";
  base.style.cssText = "position:fixed;inset:0;z-index:9999;background:#c9cfa8;padding:24px;display:block;font-family:var(--sans)";
  const M = { overview: [32, 24], operational: [54, 39], detail: [58, 56] };
  const card = (lvl, o) => {
    const [w, h] = M[lvl]; const b = o.b ?? {};
    const inner = `<span class="unit-counter-head"><span class="unit-counter-symbol">${o.sym}</span>${lvl === "overview" ? `<span class="m3-air-tag">${o.tag === "AIR" ? "Air" : o.tag[0]}</span>` : `<span class="unit-counter-designation">${o.des}</span>`}</span>${lvl === "overview" ? "" : `<span class="m3-air-tag">${o.tag}</span><span class="m3-air-nums">${o.nums}</span>`}<span class="unit-counter-bar"></span>${o.badge ? `<span class="unit-counter-badge">✓</span>` : ""}${o.ground ? `<span class="m3-ground-badge" title="Grounded">☁</span>` : ""}${o.count ? `<span class="m3-air-count">×${o.count}</span>` : ""}`;
    return `<span style="position:relative;display:inline-block;width:${w}px;height:${h}px"><span class="unit-counter m3-air" ${o.sel ? 'data-selected="true"' : ""} ${o.badge ? 'data-ordered="true"' : ""} ${o.ground ? 'data-grounded="true"' : ""} style="--faction-color:${o.col};left:0;top:0;width:${w}px;height:${h}px;--strength-share:1">${inner}</span></span>`;
  };
  const gunit = (lvl, v, des, col = rep) => { const [w, h] = M[lvl]; return `<span style="position:relative;display:inline-block;width:${w}px;height:${h}px"><span class="unit-counter" style="--faction-color:${col};left:0;top:0;width:${w}px;height:${h}px;--strength-share:.8">${lvl === "overview" ? "" : `<span class="unit-counter-head"><span class="unit-counter-symbol">${document.querySelector(".unit-counter-symbol svg")?.outerHTML ?? ""}</span><span class="unit-counter-designation">${des}</span></span>`}<span class="unit-counter-values"><span class="unit-counter-current">${v}</span></span>${lvl === "detail" ? `<span class="unit-counter-men">2500</span>` : ""}<span class="unit-counter-bar"></span></span></span>`; };
  const F = (x = {}) => ({ sym: ni, tag: "FTR", des: "Ni52", nums: "Air +2", range: "Reach 3", col: rep, ...x });
  const B = (x = {}) => ({ sym: br, tag: "BOMB", des: "Br19", nums: "Supp +3", range: "Reach 4", col: rep, ...x });
  const R = (x = {}) => ({ sym: rc, tag: "RCN", des: "Rec", nums: "Reach 4", range: "Reach 4", col: rep, ...x });
  const row = (title, lvl) => `<div style="display:grid;grid-template-columns:150px repeat(6,1fr);gap:10px 26px;align-items:center;margin-bottom:30px"><strong style="font:700 18px var(--serif)">${title}</strong>${[["Fighter", card(lvl, F())], ["Bomber", card(lvl, B())], ["Recon", card(lvl, R())], ["Mission planned", card(lvl, F({ badge: 1 }))], ["Selected", card(lvl, B({ sel: 1 }))], ["Grounded by rain", card(lvl, B({ ground: 1 }))]].map(([c, m]) => `<div style="text-align:center"><div class="counter-layer" data-level="${lvl}" style="position:static;pointer-events:auto;display:grid;place-items:center;min-height:62px">${m}</div><small style="font:600 12px var(--sans)">${c}</small></div>`).join("")}</div>`;
  const stack = `<div style="display:flex;gap:40px;align-items:flex-end;margin-top:8px"><div><div class="counter-layer" data-level="operational" style="position:static;display:grid;gap:4px"><div style="display:flex;gap:4px">${card("operational", F())}${card("operational", B())}</div><div style="display:flex;gap:4px">${gunit("operational", "4-6", "14th")}${gunit("operational", "3-5", "AG")}${gunit("operational", "3-4", "M2")}</div></div><small style="font:600 12px var(--sans)">Two aircraft stacked above ground units: the same card, the same row rules</small></div><div><div class="counter-layer" data-level="overview" style="position:static;display:grid;gap:14px;justify-items:center">${card("overview", F({ count: 2, tag: "AIR" }))}</div><small style="font:600 12px var(--sans)">Overview: 2+ aircraft at one base share a card</small></div><div><div class="counter-layer" data-level="detail" style="position:static;display:flex;gap:4px">${card("detail", F({ col: sth, sym: ju, tag: "BOMB", des: "Ju52", nums: "Supp +3" }))}${card("detail", R({ col: nor }))}</div><small style="font:600 12px var(--sans)">Enemy colours, detail</small></div></div>`;
  base.innerHTML = `<h2 style="font:700 24px var(--serif);margin:0 0 16px">Aircraft card, every state (A)</h2>${row("Overview 32×24", "overview")}${row("Operational 54×39", "operational")}${row("Detail 58×56", "detail")}${stack}`;
  base.style.width = "1100px"; document.body.append(base);
  for (const h of base.querySelectorAll(".counter-layer")) h.style.width = "auto";
});
await page.waitForTimeout(200);
await shot(page, "2-air-states", { clip: { x: 0, y: 0, width: 1100, height: 620 }, final: true });
await browser.close();
