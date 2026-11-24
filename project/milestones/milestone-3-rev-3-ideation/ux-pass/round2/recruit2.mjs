// Item 4: Recruit with a fold-out line per unit and the owner's CSV costs, training, values and upkeep.
import { browser, newPage, start, openView, css, shot, sheet } from "./lib2.mjs";
export const CSV = { "Infantry regiment": [5, 1, .25, "4-6", 2], "Militia column": [3, 3, 1.5, "2-5", 1], "Colonial veterans": [7, 2, .25, "6-6", 2], "Security forces": [5, 1, .75, "2-6", 1], "Artillery group": [6, 1, .1, "2-3", 2], "Cavalry regiment": [4, 1, .3, "3-3", 2], "Tank company": [8, 1, .15, "5-3", 3], "Truck column": [3, 1, .1, "0-0", 1], "Anti-air battery": [5, 1, .15, "0-1", 2], "Reconnaissance flight": [5, 1, .05, "0-1", 2], "Fighter squadron": [6, 1, .05, "0-1", 3], "Bomber squadron": [7, 1, .05, "0-1", 3] };
const FX = {
  "Militia column": ["Keeps training even while the territory is contested. Needs no buildings."],
  "Artillery group": ["+1 on the attack roll for every 2 artillery attack points, up to +3.", "Can't attack alone: needs at least one other ground unit in the attack."],
  "Cavalry regiment": ["Needs no truck: an all-cavalry army moves +1, and rough ground does not slow it."],
  "Tank company": ["+1 on the attack roll for every 3 tank attack points, up to +2. Nothing in mud or snow.", "Carries 1 unit."],
  "Truck column": ["Carries 2 units: an army moves +1 when its trucks and tanks can carry every unit that needs one.", "No combat value."],
  "Anti-air battery": ["Enemy raids here roll 3 lower.", "When defending, adds +3 to your air battle roll."],
  "Reconnaissance flight": ["Flies recon up to 4 territories away."],
  "Fighter squadron": ["Adds +2 to your air battle roll.", "Ground Support: +3 to a ground battle if your side wins the air. At most two aircraft count."],
  "Bomber squadron": ["Adds +1 to your air battle roll.", "Ground Support: +3 to a ground battle if your side wins the air. At most two aircraft count.", "Raids cut income or damage a building up to 4 territories away."]
};
const style = `.pane-tab-list{flex-wrap:wrap}.pane-tab{padding:4px 9px!important;gap:4px!important}.map-pane-body{overflow-x:hidden!important}.recruit-list{container-type:inline-size;grid-template-columns:minmax(0,1fr)}
.recruit-row{grid-template-columns:2.1rem minmax(0,1fr) auto auto;overflow-wrap:break-word}.recruit-stepper{align-self:start}
@container (width < 20rem){.recruit-row{grid-template-columns:2.1rem minmax(0,1fr) auto!important}.recruit-row .recruit-stepper{grid-column:2/-1!important;grid-row:auto!important;justify-self:start;margin-top:4px}.recruit-meta{grid-column:2/-1!important}}
.m3-fold{grid-column:2/-1;margin-top:4px}.m3-fold summary{display:inline-block;font:650 .78rem var(--sans);color:var(--route);cursor:pointer;padding:3px 0;list-style:none}.m3-fold summary::-webkit-details-marker{display:none}.m3-fold summary::before{content:"\\25B8\\00A0";font-size:1rem}.m3-fold[open] summary::before{content:"\\25BE\\00A0";font-size:1rem}
.m3-fold ul{margin:.15rem 0 .1rem;padding:.3rem .5rem .3rem 1.2rem;border-left:3px solid var(--gold);background:var(--gold-wash);list-style:disc}.m3-fold li{font-size:.8rem;line-height:1.35;margin:.08rem 0;overflow-wrap:anywhere}
.map-pane-toggle{padding:0 .6rem!important;min-width:36px}.map-pane-toggle>span:last-child{display:none}`;
const apply = ({ CSV, FX, open }) => {
  for (const row of document.querySelectorAll(".recruit-row")) {
    const n = row.querySelector(".recruit-name").textContent, c = CSV[n]; if (!c) continue;
    row.querySelector(".recruit-values").textContent = c[3];
    const meta = row.querySelector(".recruit-meta"); const men = meta.textContent.split(" · ").find((p) => /men$/.test(p));
    if (row.dataset.locked !== "true") meta.textContent = `${c[0]} Funds · ${c[1]}k Manpower to raise, ${c[2]}k a turn · ${men} · ${c[4]} ${c[4] === 1 ? "turn" : "turns"}`;
    const fx = FX[n]; if (fx && row.dataset.locked !== "true") { const d = document.createElement("details"); d.className = "m3-fold"; d.open = open === n; d.innerHTML = `<summary>Special effects</summary><ul>${fx.map((x) => `<li>${x}</li>`).join("")}</ul>`; row.append(d); }
  }
  document.querySelectorAll(".recruit-details").forEach((d) => { d.style.display = "none"; });
};
async function run(name, width, open, scrollTo) {
  const page = await newPage("desktop"); await start(page); await openView(page, { kind: "recruit", territory: "madrid" }); await page.waitForTimeout(300);
  await css(page, style + `.map-pane{width:${width}px!important}`); await page.evaluate(apply, { CSV, FX, open }); await page.waitForTimeout(200);
  await page.evaluate((s) => { const b = document.querySelector(".map-pane-body"), r = [...document.querySelectorAll(".recruit-row")].find((e) => e.querySelector(".recruit-name").textContent === s); b.scrollTop += r.getBoundingClientRect().top - b.getBoundingClientRect().top - 8; }, scrollTo);
  await page.waitForTimeout(150);
  console.log(name, JSON.stringify(await page.evaluate(() => { const b = document.querySelector(".map-pane-body"); return { over: b.scrollWidth - b.clientWidth, rowOver: [...document.querySelectorAll(".recruit-row")].filter((r) => r.scrollWidth > r.clientWidth).length, heights: [...document.querySelectorAll(".recruit-row")].map((r) => Math.round(r.getBoundingClientRect().height)).join(",") }; })));
  await shot(page, `4-${name}`, { locator: ".map-pane" }); await page.context().close();
}
if (process.argv[1].endsWith("recruit2.mjs")) {
  await run("416", 416, "Artillery group", "Infantry regiment"); await run("320", 320, "Artillery group", "Security forces");
  await sheet("4-recruit-foldout", [{ src: "4-416", caption: ["Pane at 416 px, one fold-out open", "Values, costs, training and upkeep from the owner's table"] }, { src: "4-320", caption: ["Pane at 320 px"] }]);
  await browser.close();
}
