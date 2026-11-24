// Note 4: unit effects on the Recruit list. Wording is the proposal in research/ux.md.
import { browser, newPage, start, openView, shot, sheet, css } from "./lib.mjs";
const EFFECTS = {
  "Militia column": [["Trains in contested ground", "Keeps training even while the territory is contested. Needs no buildings."]],
  "Artillery group": [["Attack bonus", "+1 on the attack roll for every 3 artillery attack points, up to +3."], ["Can't attack alone", "Needs at least one other ground unit in the attack."]],
  "Cavalry regiment": [["Mounted", "Needs no truck: an all-cavalry army moves +1, and rough ground does not slow it."]],
  "Tank company": [["Attack bonus", "+1 on the attack roll for every 3 tank attack points, up to +2. Nothing in mud or snow."]],
  "Truck column": [["Carries 2 units", "An army moves +1 when its trucks can carry every unit that needs one. No combat value."]],
  "Anti-air battery": [["Anti-air 3", "Enemy raids here roll 3 lower. When defending, adds +3 to your air battle roll."]],
  "Reconnaissance flight": [["Scouts", "Flies recon up to 4 territories: shows what it sees for 1 turn."]],
  "Fighter squadron": [["Air battle +2", "Adds +2 to your air battle roll."], ["Ground Support +3", "Adds +3 to a ground battle, if your side wins the air. At most two aircraft count."]],
  "Bomber squadron": [["Air battle +1", "Adds +1 to your air battle roll."], ["Ground Support +3", "Adds +3 to a ground battle, if your side wins the air. At most two aircraft count."], ["Raids", "Cuts income or damages a building up to 4 territories away."]]
};
const style = `.pane-tab-list{flex-wrap:wrap}.pane-tab{padding:4px 9px!important;gap:4px!important}.map-pane-body{overflow-x:hidden!important}.recruit-list{container-type:inline-size}
@container (width < 20rem){.recruit-row{grid-template-columns:2.1rem minmax(0,1fr) auto!important}.recruit-row .recruit-stepper{grid-column:2/-1!important;grid-row:auto!important;justify-self:start;margin-top:4px}.recruit-meta{grid-column:2/-1!important}}

.recruit-list{grid-template-columns:minmax(0,1fr)} .recruit-row{grid-template-columns:2.1rem minmax(0,1fr) auto auto;overflow-wrap:break-word}
.m3-fx{grid-column:2/-1;display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;min-width:0}
.m3-fx button{min-height:26px;max-width:100%;padding:.08rem .55rem;border:1px solid rgb(36 29 24/30%);border-radius:999px;background:rgb(255 255 255/75%);color:var(--ink);font:650 .74rem/1.25 var(--sans);text-align:left;white-space:normal;overflow-wrap:anywhere}
.m3-fx button[aria-expanded="true"]{background:var(--ink);color:var(--paper)}
.m3-fx-detail{grid-column:2/-1;margin:.3rem 0 0;padding:.35rem .55rem;border-left:3px solid var(--gold);background:var(--gold-wash);font-size:.8rem;line-height:1.35}
.m3-exp{grid-column:2/-1;margin-top:4px}.m3-exp summary{font:650 .78rem var(--sans);color:var(--route);cursor:pointer}.m3-exp li{font-size:.8rem;margin:.1rem 0}
.recruit-stepper{align-self:start}
@media(width<=720px){.m3-fx button{min-height:32px}}
`;
const apply = ({ FX, mode, openAll }) => {
  for (const row of document.querySelectorAll(".recruit-row")) {
    const n = row.querySelector(".recruit-name").textContent; const list = FX[n] ?? [];
    if (mode === "chips" && list.length) {
      const f = document.createElement("span"); f.className = "m3-fx"; f.setAttribute("role", "group"); f.setAttribute("aria-label", `${n}: special effects`);
      f.innerHTML = list.length ? list.map(([t], i) => `<button type="button" aria-expanded="${openAll === n && i === 0 ? "true" : "false"}">${t}</button>`).join("") : `<small style="color:var(--ink-soft)">No special effects</small>`;
      row.append(f);
      if (openAll === n && list.length) { const d = document.createElement("p"); d.className = "m3-fx-detail"; d.textContent = list[0][1]; row.append(d); }
    }
    if (mode === "details" && list.length) { const d = document.createElement("details"); d.className = "m3-exp"; d.open = openAll === n; d.innerHTML = `<summary>${list.length === 1 ? "1 special effect" : `${list.length} special effects`}</summary><ul style="margin:.2rem 0 0;padding-left:1.1rem">${list.map(([t, x]) => `<li><b>${t}.</b> ${x}</li>`).join("")}</ul>`; row.append(d); }
  }
  for (const d of document.querySelectorAll(".recruit-details")) d.style.display = "none";
};
async function run(kind, name, opts, size, paneW) {
  const page = await newPage(kind, size);
  await start(page);
  await openView(page, { kind: "recruit", territory: "madrid" });
  await page.waitForTimeout(300);
  if (paneW) { await css(page, `.map-pane{width:${paneW}px!important}`); }
  if (kind === "phone") await css(page, `.campaign-map[data-pane-layout="sheet"] .map-pane[data-open="true"]{max-height:88%!important}`);
  if (opts.mode) { await css(page, style); await page.evaluate(apply, { FX: EFFECTS, ...opts }); }
  if (opts.font) await page.evaluate((f) => { document.documentElement.style.fontSize = f; }, opts.font);
  await page.evaluate(() => { document.querySelector(".map-pane-body").scrollTop = 0; });
  await page.evaluate((s) => { const b = document.querySelector(".map-pane-body"); const a = document.querySelector(".recruit-list"); b.scrollTop += a.getBoundingClientRect().top - b.getBoundingClientRect().top - 6 + s; }, opts.scroll ?? 0);
  await page.waitForTimeout(250);
  const over = await page.evaluate(() => { const b = document.querySelector(".map-pane-body"); return [b.scrollWidth - b.clientWidth, [...document.querySelectorAll(".recruit-row")].map((r) => r.scrollWidth - r.clientWidth).filter((v) => v > 0).length, [...document.querySelectorAll(".recruit-row")].map((r) => Math.round(r.getBoundingClientRect().height)).join(",")]; });
  console.log(kind, name, JSON.stringify(over));
  await shot(page, `4-${name}`, kind === "phone" ? {} : { locator: ".map-pane" });
  await page.context().close();
}
await run("desktop", "before", { scroll: 180 });
await run("desktop", "before-320-large", { font: "200%" }, undefined, 320);
await run("desktop", "a-chips", { scroll: 290, mode: "chips", openAll: "Artillery group" });
await run("desktop", "b-details", { scroll: 260, mode: "details", openAll: "Artillery group" });
await run("desktop", "a-320", { scroll: 430, mode: "chips", openAll: "Artillery group" }, undefined, 320);
await run("desktop", "a-320-large", { scroll: 720, mode: "chips", openAll: "Artillery group", font: "150%" }, undefined, 320);
await run("phone", "a-phone", { scroll: 250, mode: "chips", openAll: "Artillery group" });
await sheet("4-recruit-chips", [{ src: "4-before", caption: "Now, 416 px" }, { src: "4-a-chips", caption: "A (recommended): chips, one open" }, { src: "4-b-details", caption: "B: fold-out list" }], { height: 640 });
await sheet("4-recruit-narrow", [{ src: "4-a-320", caption: "A at 320 px" }, { src: "4-a-320-large", caption: "A at 320 px, 150% text" }, { src: "4-a-phone", caption: "A, phone" }], { height: 640 });
await browser.close();
