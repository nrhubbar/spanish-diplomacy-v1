// Item 1: aircraft as the same unit card as ground units, printing attack-defence; and a variant with a role word.
import { browser, newPage, start, css, shot, sheet } from "./lib2.mjs";
import { zoomTo } from "../before.mjs";
import { engine } from "./engine.mjs";
const airCss = `.air-layer-mock .air-counter{display:none}
.m3-letter{position:absolute;left:-6px;bottom:-9px;min-width:15px;height:15px;border-radius:4px;background:var(--ink);color:var(--paper);border:1.5px solid var(--paper);font-size:10px;font-weight:800;line-height:12px;text-align:center}
.unit-counter.m3-air .unit-counter-designation{font-size:10px;letter-spacing:-.03em}.unit-counter.m3-air .unit-counter-symbol{width:12px;height:8px;flex:none}.unit-counter.m3-air .unit-counter-head{gap:2px}.unit-counter.m3-air[data-role="true"] .unit-counter-designation{font-size:9.5px;overflow:visible}`;
const page = await newPage(); await start(page); await engine(page); await css(page, airCss);
await page.evaluate(() => { window.__syms = {}; for (const e of document.querySelectorAll(".air-counter")) window.__syms[e.dataset.unitId] = e.querySelector("svg").outerHTML; });
const clip = { x: 330, y: 260, width: 460, height: 260 };
const cards = (role) => page.evaluate((role) => {
  document.querySelectorAll("[data-mock]").forEach((e) => e.remove()); document.querySelector(".air-layer").classList.remove("air-layer-mock");
  const E = window.__eng, S = window.__sc, st = window.M3D.S().game.state;
  const lvl = document.querySelector(".map-surface").dataset.semanticLevel, M = { overview: [32, 24, 2], operational: [54, 39, 4], detail: [58, 56, 4] }[lvl];
  const layer = document.createElement("div"); layer.className = "counter-layer"; layer.dataset.level = lvl; layer.dataset.mock = "1";
  const surf = document.querySelector(".map-surface").getBoundingClientRect(), by = {};
  for (const e of document.querySelectorAll(".air-counter")) { const r = e.getBoundingClientRect(); (by[e.dataset.unitId.split("-")[0] + Math.round(r.top / 20)] ??= []).push([e, r]); }
  for (const row of Object.values(by)) {
    const ground = [...document.querySelectorAll(".unit-counter:not(.m3-air)")].map((g) => g.getBoundingClientRect()); const f = row[0][1], w = row.length * M[0] + (row.length - 1) * M[2];
    const x = f.left - surf.left + f.width * row.length / 2 - w / 2; let y = f.top - surf.top + f.height / 2 - M[1] / 2;
    for (let k = 0; k < 14; k += 1) { if (!ground.some((g) => g.left - surf.left < x + w && x < g.right - surf.left && g.top - surf.top < y + M[1] && y < g.bottom - surf.top)) break; y -= 6; }
    row.forEach(([e], i) => {
      const id = e.dataset.unitId, u = st.units[id], def = st.raised[id] ?? S.index.units.get(id), type = S.index.unitTypes.get(def.type), fig = E.armyFigures(S, st, u);
      const tag = /fighter/.test(type.id) ? "FTR" : /recon/.test(type.id) ? "RCN" : "BOMB";
      const c = document.createElement("button"); c.className = "unit-counter m3-air"; c.type = "button"; c.dataset.unit = id; c.dataset.role = String(role); c.style.cssText = `--faction-color:${e.style.getPropertyValue("--faction-color")};left:${x + i * (M[0] + M[2])}px;top:${y}px;width:${M[0]}px;height:${M[1]}px;--strength-share:${E.strengthShare(fig)}`;
      if (e.dataset.planned === "true") c.dataset.ordered = "true";
      const roleHtml = role && lvl === "overview" ? `<span class="m3-letter">${tag[0]}</span>` : "";
      c.innerHTML = `<span class="unit-counter-head"><span class="unit-counter-symbol">${window.__syms[id]}</span><span class="unit-counter-designation">${role ? tag : E.unitDesignation(def.name)}</span></span><span class="unit-counter-values"><span class="unit-counter-current">${E.valuesLabel(type.attack, type.defence)}</span></span><span class="unit-counter-men">${E.menLabel(fig)}</span><span class="unit-counter-bar"></span>${e.dataset.planned === "true" ? '<span class="unit-counter-badge">✓</span>' : ""}${roleHtml}`;
      layer.append(c);
    });
  }
  document.querySelector(".air-layer").classList.add("air-layer-mock"); document.querySelector(".map-surface").append(layer);
  return [...document.querySelectorAll(".m3-air")].map((c) => [c.querySelector(".unit-counter-designation").scrollWidth - c.querySelector(".unit-counter-designation").clientWidth, c.dataset.unit, c.textContent, c.getBoundingClientRect().width, c.scrollWidth > c.clientWidth]);
}, role);
for (const [steps, name] of [[0, "overview"], [2, "operational"], [6, "detail"]]) {
  await page.evaluate(() => { document.querySelectorAll('[data-mock]').forEach((e) => e.remove()); document.querySelector('.air-layer').classList.remove('air-layer-mock'); });
  await zoomTo(page, '[data-unit-id="rep-ni52-fighters"]', steps); await page.waitForTimeout(300);
  for (const [k, role] of [["a", false], ["b", true]]) { console.log(name, k, JSON.stringify(await cards(role))); await shot(page, `2-${k}-${name}`, { clip }); }
}
await sheet("2-air-cards", ["overview", "operational", "detail"].flatMap((z, i) => [{ src: `2-a-${z}`, caption: [`As asked: the same card, ${z} zoom`, ["At this zoom the card prints only 0-1, like any overview unit", "Same card, same size; 0-1 for all three aircraft", "Same card; men shown as on ground units"][i]] }, { src: `2-b-${z}`, caption: [`With the role word, ${z} zoom`, i === 0 ? "A letter badge: F, B or R" : "FTR, BOMB or RCN replaces the short name"] }]), { cols: 2, gap: 20, pad: 18, font: 16 });
await browser.close();
