// Items 5 (casualties), 6 (upkeep) and 7 (Build row). Usage: node rest2.mjs [cas|up|build]
import { browser, newPage, start, openView, css, shot, sheet } from "./lib2.mjs";
import { engine } from "./engine.mjs";
const only = process.argv[2];
const SKULL = '<svg aria-hidden="true" class="economy-icon" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.3"><path d="M8 1.6c-2.5 0-4 1.6-4 3.7 0 1.4.7 2.3 1.5 2.8v1.6h5V8.1c.8-.5 1.5-1.4 1.5-2.8 0-2.1-1.5-3.7-4-3.7M7.1 9.7V8.4M8.9 9.7V8.4M2.6 11.4l10.8 3M13.4 11.4l-10.8 3M2.9 10.6a.9.9 0 1 0 0 1.6M13.1 10.6a.9.9 0 1 1 0 1.6M2.9 13.6a.9.9 0 1 1 0 1.6M13.1 13.6a.9.9 0 1 0 0 1.6"/><path d="M6.4 4.9h.01M9.6 4.9h.01" stroke-width="2"/></svg>';
const CAS = `.m3-cas{display:inline-flex;align-items:center;gap:.35rem;min-height:34px;padding:.15rem .7rem;border:1px solid var(--rule);border-radius:999px;background:rgb(255 255 255/45%);color:var(--ink);font:700 .86rem var(--sans);white-space:nowrap;font-variant-numeric:tabular-nums;position:relative}.m3-cas .economy-icon{width:18px;height:18px}
.m3-pop{position:absolute;z-index:40;top:calc(100% + 6px);left:0;width:236px;padding:.6rem .8rem;border:1px solid var(--ink);border-radius:8px;background:var(--paper);box-shadow:0 6px 18px rgb(0 0 0/30%);font:600 .84rem var(--sans);white-space:normal;color:var(--ink)}.m3-pop ul{margin:.4rem 0 0;padding:0}.m3-pop li{display:flex;justify-content:space-between;padding:.15rem 0;list-style:none}.m3-pop small{display:block;margin-top:.35rem;font-weight:400;color:var(--ink-soft)}
@media(720px < width <= 1400px){.game-header{flex-wrap:wrap!important}.game-header-actions{margin-left:auto!important}.game-header .resource-name{display:none}}@media(width<=720px){.m3-pop{left:auto;right:0}.m3-cas{min-height:30px;padding:.1rem .55rem;font-size:.8rem}}`;
const short = (n) => (n < 1000 ? String(n) : n < 1e6 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${(n / 1e6).toFixed(1)}M`);
if (!only || only === "cas") {
  // The true battle losses of seed 42, turns 2 to 6, by the side that lost them (battles only).
  const b = await newPage(); await start(b, { orders2: true }); const losses = {};
  for (let t = 2; t <= 6; t += 1) { await b.evaluate(() => window.M3D.d("game/endTurn")); await b.waitForTimeout(250); if (t < 6) { await b.evaluate(() => window.M3D.d("game/startNextTurn")); await b.waitForTimeout(150); } }
  await b.evaluate(() => window.M3D.d("game/startNextTurn")); await b.waitForTimeout(200);
  // Every turn's recorded outcomes are kept in the session's history; losses name units, and the armies name their faction.
  const got = await b.evaluate(() => { const g = window.M3D.S().game; const out = {}; const turns = g.history.map((h) => Object.keys(h)); let n = 0;
    for (const h of g.history) for (const o of (h.result?.outcomes ?? h.outcomes ?? [])) if (o.kind === "battle") { n += 1; const fac = Object.fromEntries([...o.attacker.armies, ...o.defender.armies].map((a) => [a.unitId, a.factionId])); for (const l of o.losses) { const f = l.factionId ?? fac[l.unitId]; const men = l.menLost ?? l.men ?? l.lost ?? l.strengthLost ?? 0; out[f] = (out[f] ?? 0) + men; } }
    return { out, turns: turns[0], n, sample: g.history.flatMap((h) => (h.result?.outcomes ?? h.outcomes ?? []).filter((o) => o.kind === "battle"))[0]?.losses?.[0], count: g.history.length, has: g.history.map((h) => (h.result?.outcomes ?? h.outcomes ?? []).filter((o) => o.kind === "battle").length) }; });
  console.log(JSON.stringify({ ...got, out: undefined })); Object.assign(losses, got.out);
  console.log("losses", JSON.stringify(losses)); await b.context().close();
  const order = ["republic", "north", "south"], names = { republic: "Republican", north: "Northern", south: "Southern" }, total = order.reduce((s, f) => s + (losses[f] ?? 0), 0); console.log("total", total);
  const put = ({ S, total, losses, order, names, pop, skull }) => { const h1 = document.querySelector(".game-header h1, .game-header h2"); const el = document.createElement("button"); el.className = "m3-cas"; el.type = "button"; el.setAttribute("aria-label", `Casualties, all sides: ${total.toLocaleString("en")} men`); el.innerHTML = skull + `<span>${S}</span>` + (pop ? `<span class="m3-pop" role="dialog"><strong>Casualties since turn 1</strong><ul>${order.map((f) => `<li><span>${names[f]}</span><b>${(losses[f] ?? 0).toLocaleString("en")}</b></li>`).join("")}<li style="border-top:1px solid var(--rule)"><span>All sides</span><b>${total.toLocaleString("en")}</b></li></ul></span>` : ""); const r = document.createElement("div"); r.style.cssText = "display:flex;align-items:center;gap:.6rem;flex-wrap:wrap"; h1.replaceWith(r); r.append(h1, el); };
  for (const [kind, w] of [["desktop", 1440], ["phone", 412]]) for (const pop of [false, true]) {
    const page = kind === "phone" ? await newPage("phone") : await newPage("desktop", { width: w, height: 800 }); await start(page, { orders2: true });
    await page.evaluate(() => { for (let t = 2; t <= 6; t += 1) { window.M3D.d("game/endTurn"); if (t < 6) window.M3D.d("game/startNextTurn"); } window.M3D.d("game/startNextTurn"); }); await page.waitForTimeout(700);
    await css(page, CAS); await page.evaluate(put, { S: short(total), total, losses, order, names, pop, skull: SKULL }); await page.waitForTimeout(250);
    const m = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth, header: Math.round(document.querySelector(".game-header").getBoundingClientRect().height) })); console.log(kind, w, JSON.stringify(m));
    await shot(page, `9-${kind}-${pop ? "open" : "closed"}`, { clip: { x: 0, y: 0, width: kind === "phone" ? 412 : 900, height: kind === "phone" ? 330 : 300 } }); await page.context().close();
  }
  // the icon large, beside the app's own icons
  const page = await newPage(); await start(page); await page.evaluate((s) => { const d = document.createElement("div"); d.id = "ico"; d.style.cssText = "position:fixed;left:0;top:0;z-index:9999;display:flex;gap:26px;align-items:center;background:#efe8da;padding:14px 18px;color:#241d18"; const names = [...document.querySelectorAll("svg.economy-icon")].slice(0, 2).map((e) => e.outerHTML); d.innerHTML = [s, ...names].map((h) => `<span style="display:inline-block;transform:scale(2.6);transform-origin:center;margin:0 16px">${h}</span>`).join("") + [s, ...names].map((h) => `<span>${h}</span>`).join(""); document.body.append(d); }, SKULL);
  await shot(page, "9-icon", { locator: "#ico" });
  await sheet("9-casualties", [{ src: "9-desktop-closed", caption: "Desktop 1440 px" }, { src: "9-desktop-open", caption: "Tapped: split by side" }, { src: "9-phone-closed", caption: "Phone 412 px", scale: .55 }, { src: "9-phone-open", caption: "Phone, tapped", scale: .55 }, { src: "9-icon", caption: "The icon, large and 16 px" }], { cols: 2, gap: 20, maxWidth: 1500 });
}
const U = `.ledger .m3-sub th{font-weight:400;padding-left:1.2rem;color:var(--ink-soft)}.ledger .m3-sub td{color:var(--ink-soft)}.ledger .m3-up th,.ledger .m3-up td{font-weight:750}.m3-up button{min-height:0!important;border:0;background:none;padding:0;font:inherit;color:inherit;cursor:pointer}.m3-neg{color:#9a2f14!important}
.m3-warn{margin:0 0 .7rem;padding:.6rem .75rem;border:1px solid #9a2f14;border-left:5px solid #9a2f14;border-radius:8px;background:#fbeee6;font-size:.86rem;line-height:1.4}.m3-warn strong{display:block;font-size:.92rem;color:#9a2f14}
.m3-disband{display:flex;justify-content:space-between;align-items:center;gap:.6rem;margin:0 0 .5rem;padding:.35rem .6rem .45rem;border:1px solid var(--rule);border-top:0;border-radius:0 0 8px 8px;background:rgb(255 255 255/55%);font-size:.8rem;color:var(--ink-soft)}.m3-disband button{min-height:30px;padding:0 .7rem;border:1px solid #9a2f14;border-radius:6px;background:var(--paper);color:#9a2f14;font:700 .8rem var(--sans)}.m3-disband.confirm{background:#fbeee6}`;
async function t3(page) { await start(page, { orders2: true }); await page.evaluate(() => { window.M3D.d("game/endTurn"); window.M3D.d("game/startNextTurn"); }); await page.waitForTimeout(500); }
if (!only || only === "up") {
  // Real: Republic, turn 3, seed 42: stock 47k, income 23k, upkeep 15.65k from the owner's rates (7 militia x 1.5, 11 infantry x 0.25, 3 security x 0.75, 3 aircraft x 0.05).
  const page = await newPage(); await t3(page); await css(page, U);
  await page.locator(".resource-chip").filter({ hasText: "Manpower" }).click(); await page.waitForTimeout(300);
  console.log(await page.evaluate(() => [...document.querySelectorAll(".resource-chip, .resource-balance, .resource-next, .resource-delta")].map((e) => e.className + "=" + e.textContent).join(" | ") + " || " + [...document.querySelectorAll(".ledger tr")].map((r) => r.textContent).join(" ; ")));
  await page.evaluate(() => {
    const fmt = (v) => `−${String(v)}k`; const table = document.querySelector(".ledger"); const row = [...table.querySelectorAll("tbody tr")].find((r) => /^Upkeep/.test(r.textContent));
    row.className = "m3-up"; row.innerHTML = `<th scope="row"><button aria-expanded="true">▾ Upkeep</button> <span class="ledger-note">24 units</span></th><td class="ledger-yield"></td><td class="ledger-value m3-neg">${fmt(15.65)}</td>`;
    const sub = [["Militia column", 7, 1.5], ["Infantry regiment", 11, .25], ["Security forces", 3, .75], ["Aircraft", 3, .05]];
    row.insertAdjacentHTML("afterend", sub.map(([n, c, r]) => `<tr class="m3-sub"><th scope="row">${n}, ${c} at ${r}k</th><td></td><td>${fmt(Math.round(c * r * 100) / 100)}</td></tr>`).join(""));
    const foot = table.querySelector("tfoot .ledger-value"); const inc = Number(foot.textContent.replace(/[^\d-]/g, "")); foot.textContent = "+7.35k"; foot.classList.add("m3-total");
    const chip = [...document.querySelectorAll(".resource-chip")].find((c) => /Manpower/.test(c.textContent)); window.__inc = inc; const n = [...chip.querySelectorAll("*")].find((e) => e.children.length === 0 && /\+\d+k/.test(e.textContent)); if (n) n.textContent = n.textContent.replace(/\+\d+k/, "+7k"); const h = [...document.querySelectorAll(".resource-detail *")].find((e) => e.children.length === 0 && /next turn/.test(e.textContent) && /47k/.test(e.textContent)); if (h) h.textContent = h.textContent.replace("+23k", "+7.35k"); return inc;
  });
  await page.waitForTimeout(200);
  await shot(page, "6-ledger", { clip: { x: 330, y: 0, width: 640, height: 690 } });
  await page.keyboard.press("Escape"); await page.context().close();
  // Illustrative shortfall: the same army and upkeep, with stock and income lowered (stated in the caption).
  const p2 = await newPage(); await t3(p2); await css(p2, U);
  await p2.evaluate(() => { const chip = [...document.querySelectorAll(".resource-chip")].find((c) => /Manpower/.test(c.textContent)); for (const n of chip.querySelectorAll("*")) if (n.children.length === 0) { if (/^\d+k$/.test(n.textContent)) n.textContent = "3k"; else if (/\+\d+k/.test(n.textContent)) { n.textContent = n.textContent.replace(/\+\d+k/, "−7.65k"); n.classList.add("m3-neg"); } } });
  await openView(p2, { kind: "territory", id: "madrid" }); await p2.waitForTimeout(400);
  await p2.evaluate(() => { const b = document.querySelector(".map-pane-body"); b.insertAdjacentHTML("afterbegin", `<div class="m3-warn" role="alert"><strong>Manpower will be 4.65k short next turn</strong>Recruiting and Replenish are off. If you change nothing, up to 10% of each unit's men leave (never below half of it). Disband units to save their upkeep.</div>`); });
  await p2.evaluate(() => { const lis = [...document.querySelectorAll(".formation-list > li")]; const li = lis.find((l) => /Covadonga/.test(l.textContent)), li2 = lis.find((l) => /Sierra Columns/.test(l.textContent)); li.querySelector(".formation-button").insertAdjacentHTML("afterend", `<div class="m3-disband"><span>Saves 0.25k Manpower a turn</span><button>Disband</button></div>`); li2?.querySelector(".formation-button").insertAdjacentHTML("afterend", `<div class="m3-disband confirm"><span>Disband this column? Saves 1.5k a turn.</span><span style="display:flex;gap:.4rem"><button>Disband</button><button style="border-color:var(--rule);color:var(--ink)">Keep</button></span></div>`); document.querySelector(".map-pane-body").scrollTop = 0; li.scrollIntoView({ block: "center" }); document.querySelector(".map-pane-body").scrollTop = 480; });
  await p2.waitForTimeout(250); await shot(p2, "6-short", { clip: { x: 985, y: 90, width: 445, height: 700 } });
  await p2.evaluate(() => { document.querySelector(".map-pane-body").scrollTop = 0; }); await p2.waitForTimeout(150); await shot(p2, "6-short-top", { clip: { x: 640, y: 0, width: 790, height: 470 } });
  await sheet("6-upkeep-ui", [{ src: "6-ledger", caption: ["Upkeep in the Manpower ledger, by type", "Republic, turn 3, on your rates. The chip shows income less upkeep."] }]);
  await sheet("6-upkeep-disband", [{ src: "6-short-top", caption: ["Warning when next turn would go below zero", "Illustrative: stock 3k, income 8k, upkeep 15.65k"] }, { src: "6-short", caption: ["Disband on the unit cards", "Shown only while Manpower would run short"] }], { gap: 24, maxWidth: 1400 });
  await p2.context().close();
}
if (!only || only === "build") {
  const page = await newPage(); await page.evaluate(() => window.M3D.d("game/startGame", { seed: 42 })); await page.waitForTimeout(800);
  await openView(page, { kind: "territory", id: "catalunya" }); await page.waitForTimeout(500);
  await page.locator(".pane-tab").filter({ hasText: "Buildings" }).click(); await page.waitForTimeout(400);
  const all = await page.evaluate(() => { document.querySelectorAll('.site-card-toggle[aria-expanded="false"]').forEach((e) => e.click()); return 1; }); await page.waitForTimeout(400);
  console.log("turn", await page.evaluate(() => [window.M3D.S().game.state.turnNumber, [...document.querySelectorAll(".build-option")].map((e) => e.textContent.slice(0, 70)).filter((t) => /Mine|Industr/.test(t)).slice(0, 4)]));
  await page.evaluate(() => { for (const li of document.querySelectorAll(".build-option")) { const t = li.querySelector(".build-terms"); if (!t || !/Mines/.test(li.textContent)) continue; t.textContent = "5 Funds · 2 turns · +1 Funds a turn"; const p = document.createElement("span"); p.className = "build-terms"; p.style.cssText = "display:block;color:#276221;font-weight:700"; p.textContent = "Pays for itself by turn 6"; t.after(p); li.dataset.mine = "1"; break; } document.querySelector("[data-mine]")?.scrollIntoView({ block: "center" }); });
  await page.waitForTimeout(300); console.log(await page.evaluate(() => document.querySelector("[data-mine]")?.parentElement.outerHTML.slice(0, 500)));
  await shot(page, "7-row", { locator: ".map-pane" });
  await sheet("7-build-row", [{ src: "7-row", caption: ["Build row with payback, ordered on turn 1", "Mines at 5 Funds, 2 turns, as you chose"] }]);
  await page.context().close();
}
await browser.close();
