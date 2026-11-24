// Notes 1 (resize), 9 (casualties), 3 (volume UI).
import { browser, newPage, start, openView, shot, sheet, css } from "./lib.mjs";
const fix = `.m3-cas,.m3-pop{color:var(--ink)!important}.m3-cas{display:inline-flex;align-items:center;gap:.35rem;min-height:34px;padding:.15rem .7rem;border:1px solid var(--rule);border-radius:999px;background:rgb(255 255 255/45%);font:700 .86rem var(--sans);white-space:nowrap;order:2;font-variant-numeric:tabular-nums}
.m3-cas svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8}
@media(720px < width <= 1400px){.game-header{flex-wrap:wrap!important}.game-header-actions{margin-left:auto!important}.game-header .resource-name{display:none}}
@media(width<=720px){.m3-cas{min-height:30px;padding:.1rem .5rem;font-size:.78rem}.m3-cas .w{display:none}}
.m3-pop{position:absolute;z-index:40;top:calc(100% + 6px);left:0;width:230px;padding:.6rem .8rem;border:1px solid var(--ink);border-radius:8px;background:var(--paper);box-shadow:0 6px 18px rgb(0 0 0/30%);font:600 .84rem var(--sans)}
.m3-pop li{display:flex;justify-content:space-between;padding:.15rem 0;list-style:none}`;
const put = ({ compact, pop }) => {
  const big = compact ? "12.4k" : "12,418"; const h = document.querySelector(".game-header");
  const el = document.createElement("button"); el.className = "m3-cas"; el.type = "button"; el.style.position = "relative";
  el.setAttribute("aria-label", "Casualties, all sides: 12,418 men"); el.setAttribute("aria-expanded", pop ? "true" : "false");
  el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c-4 4-5 6-5 9a5 5 0 0 0 10 0c0-3-1-5-5-9z"/></svg><span>${compact ? "" : "Casualties "}${big}</span>${pop ? `<span class="m3-pop" role="dialog"><strong>Casualties since turn 1</strong><ul style="margin:.4rem 0 0;padding:0"><li><span>Republican</span><b>7,904</b></li><li><span>Northern</span><b>2,610</b></li><li><span>Southern</span><b>1,904</b></li><li style="border-top:1px solid var(--rule)"><span>All sides</span><b>12,418</b></li></ul></span>` : ""}`;
  const h1 = h.querySelector("h1"); const r = document.createElement("div"); r.style.cssText = "display:flex;align-items:center;gap:.7rem;flex-wrap:wrap"; h1.replaceWith(r); r.append(h1, el);
};
for (const w of [1440, 1280, 1024, 412]) {
  const phone = w === 412; const page = phone ? await newPage("phone") : await newPage("desktop", { width: w, height: 800 });
  await start(page); await css(page, fix); await page.evaluate(put, { compact: w <= 1440, pop: false }); await page.waitForTimeout(300);
  const m = await page.evaluate(() => { const r = document.querySelector(".game-header").getBoundingClientRect(); return { w: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: Math.round(r.height), end: Math.round(document.querySelector(".end-turn-button")?.getBoundingClientRect().right ?? 0), pane: Math.round(document.querySelector(".map-pane")?.getBoundingClientRect().width ?? 0), map: Math.round(document.querySelector(".map-surface").getBoundingClientRect().width) }; });
  console.log("header", w, JSON.stringify(m));
  await shot(page, `9-header-${w}`, { clip: { x: 0, y: 0, width: w, height: Math.min(230, m.h + 8) } });
  if (w === 1440) { await page.evaluate(() => document.querySelector(".m3-cas").remove()); await page.evaluate(put, { compact: true, pop: true }); await page.waitForTimeout(150); await shot(page, "9-pop", { clip: { x: 0, y: 0, width: 760, height: 320 } }); }
  await page.context().close();
}
await sheet("9-casualties", [{ src: "9-header-1440", caption: "1440 px: short form" }, { src: "9-header-1280", caption: "1280 px, after the wrap fix" }, { src: "9-header-1024", caption: "1024 px" }, { src: "9-header-412", caption: "Phone 412 px: short form" }, { src: "9-pop", caption: "Tapped: split by side, running total" }], { cols: 1, maxWidth: 1000 });
// 1: resize
const grip = `.m3-grip{position:absolute;left:-9px;top:0;bottom:0;width:18px;cursor:col-resize;display:grid;place-items:center;touch-action:none}.m3-grip::after{content:"";width:5px;height:64px;border-radius:3px;background:var(--ink);opacity:.55}.m3-grip:focus-visible{outline:3px solid var(--focus);border-radius:6px}
.m3-sheetgrip{position:absolute;left:50%;top:3px;width:64px;height:24px;margin-left:-32px;display:grid;place-items:center}.m3-sheetgrip::after{content:"";width:44px;height:5px;border-radius:3px;background:var(--ink);opacity:.5}`;
async function pane(w, pw, name, kind = "desktop") {
  const page = kind === "phone" ? await newPage("phone") : await newPage("desktop", { width: w, height: 800 });
  await start(page); await css(page, grip);
  if (kind === "desktop") await css(page, ".game-header{flex-wrap:wrap!important}");
  await openView(page, { kind: "territory", id: "madrid" }); await page.waitForTimeout(300);
  await page.evaluate(({ pw, kind }) => { const p = document.querySelector(".map-pane"); const g = document.createElement("div"); g.className = kind === "phone" ? "m3-sheetgrip" : "m3-grip"; g.setAttribute("role", "separator"); g.tabIndex = 0; g.setAttribute("aria-valuenow", pw); p.append(g); if (kind === "phone") p.style.maxHeight = `${pw}%`; else p.style.width = `${pw}px`; }, { pw, kind });
  await page.waitForTimeout(400);
  console.log("pane", name, JSON.stringify(await page.evaluate(() => { const p = document.querySelector(".map-pane").getBoundingClientRect(), m = document.querySelector(".map-surface").getBoundingClientRect(); return { pane: Math.round(p.width), free: Math.round(p.left - m.left), map: Math.round(m.width) }; })));
  await shot(page, `1-${name}`); await page.context().close();
}
await pane(1440, 416, "wide-416"); await pane(1440, 640, "wide-640"); await pane(1280, 300, "1280-300"); await pane(1280, 514, "1280-514");
await pane(0, 46, "phone-46", "phone"); await pane(0, 86, "phone-86", "phone");
await sheet("1-resize", [{ src: "1-wide-416", caption: "A: grip on the left edge, default 416" }, { src: "1-wide-640", caption: "Dragged to 640" }, { src: "1-1280-300", caption: "1280: minimum 300" }, { src: "1-1280-514", caption: "1280: maximum 514 (map keeps 720)" }], { cols: 2, height: 420, maxWidth: 1600 });
await sheet("1-phone", [{ src: "1-phone-46", caption: "Phone: half height (46%)" }, { src: "1-phone-86", caption: "Phone: dragged up (86%)" }], { height: 760 });
// 3: volume
const vol = `.m3-v{display:grid;grid-template-columns:7rem minmax(0,1fr) 3.4rem auto;gap:.5rem .9rem;align-items:center;margin:.6rem 0}.m3-v input[type=range]{width:100%;min-height:44px;accent-color:var(--end-turn)}.game-menu-list .m3-v{grid-template-columns:minmax(0,1fr) 3.2rem auto;gap:0 .6rem;margin:.2rem 0}.game-menu-list .m3-v label{grid-column:1/-1}.m3-v button{color:var(--ink)!important;padding:0 .7rem;font:650 .82rem var(--sans);min-height:44px;min-width:44px;border:1px solid var(--rule);border-radius:8px;background:var(--paper)}.m3-v output{font-weight:700;text-align:right}
@media(width<=560px){.m3-v{grid-template-columns:minmax(0,1fr) 3.4rem auto}.m3-v label{grid-column:1/-1}}`;
const row = (n, v, off) => `<div class="m3-v"><label for="${n}">${n}</label><input id="${n}" type="range" min="0" max="100" step="5" value="${v}"><output>${v}%</output><button aria-pressed="${off}" aria-label="Mute ${n}">${off === "true" ? "Unmute" : "Mute"}</button></div>`;
for (const kind of ["desktop", "phone"]) {
  const page = await newPage(kind); await start(page);
  const p2 = page; await css(p2, vol);
  await p2.evaluate(() => document.querySelector('.game-menu-button').click()); await p2.waitForTimeout(200);
  await p2.evaluate((html) => { const l = document.querySelector(".game-menu-list"); l.style.minWidth = "18rem"; l.insertAdjacentHTML("afterbegin", html + "<hr>"); }, `<div style="padding:.2rem .6rem"><strong>Sound</strong>${row("Master", 80, "false")}${row("Music", 60, "false")}${row("Effects", 70, "false")}</div>`);
  await p2.waitForTimeout(200);
  await shot(p2, `3-menu-${kind}`, kind === "phone" ? { clip: { x: 0, y: 0, width: 412, height: 700 } } : { clip: { x: 980, y: 0, width: 460, height: 560 } });
  await p2.goto(p2.url()); await p2.context().close();
}
for (const kind of ["desktop", "phone"]) {
  const page = await newPage(kind); await start(page);
  await page.locator(".game-menu-button").click(); await page.getByRole("button", { name: "Settings" }).click(); await page.waitForTimeout(400);
  await css(page, vol);
  await page.evaluate((html) => document.querySelector(".settings-section").insertAdjacentHTML("beforebegin", `<section class="settings-section"><h2>Sound</h2>${html}</section>`), row("Master", 80, "false") + row("Music", 60, "false") + row("Effects", 70, "true"));
  await page.waitForTimeout(200); await shot(page, `3-settings-${kind}`); await page.context().close();
}
await sheet("3-volume", [{ src: "3-settings-desktop", caption: "Settings, desktop" }, { src: "3-settings-phone", caption: "Settings, phone" }, { src: "3-menu-desktop", caption: "Menu, desktop" }, { src: "3-menu-phone", caption: "Menu, phone" }], { height: 620 });
await browser.close();
