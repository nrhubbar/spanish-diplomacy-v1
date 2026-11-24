// Note 5: battle balance sheet, drawn from real recorded battles (seed 42).
import { readFile } from "node:fs/promises";
import { browser, newPage, start, shot, sheet, css } from "./lib.mjs";
const sc = JSON.parse(await readFile(new URL("../../../../src/scenarios/spanish-civil-war-1936/scenario.json", import.meta.url), "utf8"));
const page = await newPage("desktop", { width: 1500, height: 1100 });
await start(page, { orders2: true });
const get = {};
for (let t = 2; t <= 6; t += 1) {
  await page.evaluate(() => { window.M3D.d("game/endTurn"); });
  await page.waitForTimeout(250);
  get[t] = await page.evaluate(() => { const s = window.M3D.S(); const names = Object.fromEntries(Object.entries(s.game.state.raised).map(([k, v]) => [k, v.name])); return { o: s.result.outcomes.filter((x) => x.kind === "battle" || x.kind === "air-battle"), names }; });
  if (t < 6) { await page.evaluate(() => { window.M3D.d("game/startNextTurn"); }); await page.waitForTimeout(150); }
}
const find = (t, f) => get[t].o.filter(f);
const simple = find(2, (o) => o.kind === "battle" && o.site.territoryId === "aragon")[0];
const busy = find(6, (o) => o.kind === "battle" && o.site.territoryId === "castilla-la-mancha").sort((a, b) => b.modifiers.length - a.modifiers.length)[0];
const air = find(6, (o) => o.kind === "air-battle")[0];
const three = find(4, (o) => o.kind === "battle" && o.site.territoryId === "extremadura");
const cols = sc.d20.columns ?? ["below 1:1", "1:1", "2:1", "3:1", "4:1", "5:1", "6:1"];
const un = (t, id) => sc.units.find((u) => u.id === id)?.name ?? get[t].names[id] ?? id;
const gname = (id) => sc.d20.grades.find((g) => g.id === id)?.name;
const general = (id) => (sc.generals.roster ?? sc.generals.list ?? []).find?.((g) => g.id === id)?.name ?? id.split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const label = (m) => ({ "dug-in": `Dug in, level ${m.level}`, faction: m.name, barricades: "Barricades (city held)", general: `General ${general(m.generalId ?? "")}`, trait: `${general(m.generalId ?? "")}: ${m.traitId}`, "odds-halving": `Odds below 1:1 (${m.halvings} halving${m.halvings > 1 ? "s" : ""})`, "odds-overflow": "Odds beyond 6:1", weather: `Weather: ${m.weatherId}`, "air-support": "Ground Support, bombers", fatigue: "Fatigued" }[m.kind] ?? m.kind);
const side = (m) => m.kind === "weather" || /odds/.test(m.kind) ? "both" : m.role === "attack" ? "att" : m.role === "defence" || ["dug-in", "barricades", "building"].includes(m.kind) ? "def" : "att";
const sg = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
const fac = (id) => sc.factions.find((f) => f.id === id);
const rowsOf = (o) => o.modifiers.map((m) => ({ n: label(m), r: m.roll, s: side(m) }));
function strip(o) {
  const col = sc.d20.table[o.column];
  const cell = col.map((g, i) => { const d = sc.d20.grades.find((x) => x.id === g); const c = g.startsWith("attacker") || g === "attack-checked" ? "#b06a52" : g.startsWith("defender") || g === "costly-victory" ? "#5b7d4a" : "#b9a98a"; return `<i title="${gname(g)}" style="background:${c};${i === o.score ? "outline:3px solid #241d18;outline-offset:-1px;z-index:2" : ""}"></i>`; }).join("");
  return `<div class="strip" aria-hidden="true">${cell}</div><div class="strip-lab">${o.score > 2 ? "<span>0</span>" : ""}<span style="left:clamp(22px, ${(o.score + .5) / 21 * 100}%, calc(100% - 22px))">final ${o.score}</span>${o.score < 18 ? `<span style="right:0;left:auto;transform:none">20</span>` : ""}</div>`;
}
const grp = (o, key, title) => { const r = rowsOf(o).filter((x) => x.s === key); return r.length ? `<tr class="g"><th colspan="2">${title}</th></tr>${r.map((x) => `<tr><td>${x.n}</td><td class="n ${x.r > 0 ? "pos" : "neg"}">${sg(x.r)}</td></tr>`).join("")}` : ""; };
const unitRows = (t, o, s) => { const L = [...o[s].armies].sort((p, q) => q.value - p.value); const top = L.length > 5 ? L.slice(0, 4) : L; const rest = L.slice(top.length); return unitRows0(t, top) + (rest.length ? `<tr><td>${rest.length} more units</td><td class="n">${rest.reduce((p, a) => p + a.value, 0)}</td></tr>` : ""); };
const unitRows0 = (t, L) => L.map((a) => `<tr><td>${un(t, a.unitId)}</td><td class="n">${a.value}</td></tr>`).join("");
const total = (o) => o.modifiers.reduce((s, m) => s + m.roll, 0);
const result = (o) => { const raw = o.die + total(o); return `<div class="sum"><div><small>Modifier total</small><b>${sg(total(o))}</b></div><div><small>Die (1–20)</small><b>${o.die}</b></div><div><small>${raw === o.score ? "Final number" : `Final number (${raw}, kept to 0–20)`}</small><b>${o.score}</b></div><div class="r"><small>Result</small><b>${gname(o.grade)}</b></div></div>${strip(o)}`; };
function ledger(t, o, { unitsOpen = true, air: ab } = {}) {
  const a = fac(o.attackerFactionId); const ds = [...new Set(o.defender.armies.map((x) => x.factionId))].map((id) => fac(id).name.replace(" Insurgent Command", "")).join(" and ");
  return `<section class="bs"><h3>${sc.territories.find((x) => x.id === o.site.territoryId).name}</h3>
  <div class="two"><table><caption>Attacker: ${a.name}</caption><tbody>${unitRows(t, o, "attacker")}<tr class="t"><td>Attack</td><td class="n">${o.attacker.value}</td></tr></tbody></table><table><caption>Defender: ${ds}</caption><tbody>${unitRows(t, o, "defender")}<tr class="t"><td>Defence</td><td class="n">${o.defender.value}</td></tr></tbody></table></div>
  <p class="odds">${o.attacker.value} against ${o.defender.value} rounds to <b>${o.oddsLabel}</b> odds</p>
  ${ab ? `<p class="odds">Air battle: attacker ${ab.result.attackerTotal}, defender ${ab.result.defenderTotal} (anti-air +${ab.input.defender.antiAir}). The attacker wins the air: Ground Support +${ab.support.attacker.roll}.</p>` : ""}
  <table class="mods"><caption>Effects on the roll, from the attacker's side</caption><tbody>${grp(o, "att", "Helps the attacker")}${grp(o, "def", "Helps the defender")}${grp(o, "both", "Both sides")}${o.modifiers.length ? "" : "<tr><td>No effects on this roll</td><td></td></tr>"}<tr class="t"><td>Total</td><td class="n">${sg(total(o))}</td></tr></tbody></table>${result(o)}</section>`;
}
function waterfall(t, o) {
  let run = o.die; const items = [{ n: `Die roll`, v: o.die, at: o.die }];
  for (const m of rowsOf(o)) { run += m.r; items.push({ n: m.n, v: m.r, at: run }); }
  const bar = (it) => { const from = it.n === "Die roll" ? 0 : it.at - it.v; const lo = Math.max(0, Math.min(from, it.at)), hi = Math.min(20, Math.max(from, it.at)); return `<tr><td>${it.n}</td><td class="wf"><i style="left:${lo / 20 * 100}%;width:${Math.max(1.5, (hi - lo) / 20 * 100)}%;background:${it.n === "Die roll" ? "#5b4d40" : it.v > 0 ? "#4b7a3b" : "#a4452a"}"></i></td><td class="n">${it.n === "Die roll" ? it.v : sg(it.v)}</td><td class="n run">${Math.max(0, Math.min(20, it.at))}</td></tr>`; };
  return `<section class="bs"><h3>${sc.territories.find((x) => x.id === o.site.territoryId).name}</h3><p class="odds">Attack ${o.attacker.value}, defence ${o.defender.value}: <b>${o.oddsLabel}</b></p><table class="mods"><tbody><tr class="g"><th>Step</th><th>Running score</th><th class="n">Change</th><th class="n">Now</th></tr>${items.map(bar).join("")}</tbody></table>${result(o)}</section>`;
}
const CSS = `#ov{position:fixed;inset:0;z-index:9999;background:#e9e2d3;overflow:auto;padding:20px;display:flex;gap:20px;align-items:flex-start;font-family:var(--sans)}
.bs{width:420px;flex:none;border:1px solid var(--rule);border-left:4px solid #5b4d40;border-radius:8px;background:var(--paper);padding:14px 16px;font-size:13px;color:var(--ink)}
.bs h3{margin:0 0 8px;font:700 19px var(--serif)} .bs table{width:100%;border-collapse:collapse} .bs caption{text-align:left;font-weight:750;padding:2px 0;font-size:12.5px} .bs td{padding:2px 0;vertical-align:top}.n{text-align:right;font-weight:750;font-variant-numeric:tabular-nums;white-space:nowrap}.two{display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:12px}
.t td{border-top:1.5px solid var(--ink);font-weight:750}.odds{margin:8px 0;padding:6px 8px;background:var(--gold-wash);border-radius:4px;line-height:1.35}.pos{color:#2c6a24}.neg{color:#9a2f14}.g th{text-align:left;padding-top:6px;color:var(--ink-soft);font-size:11px;font-weight:700;text-transform:none}
.sum{display:grid;grid-template-columns:repeat(4,auto);gap:10px;margin-top:10px;padding-top:8px;border-top:1px solid var(--rule)}.sum small{display:block;color:var(--ink-soft);font-size:11px}.sum b{font:700 20px var(--serif)}.sum .r b{font-size:16px}
.strip{display:grid;grid-template-columns:repeat(21,1fr);gap:1px;margin-top:8px}.strip i{height:16px;position:relative;border-radius:2px}.strip-lab{position:relative;height:16px;font-size:11px;font-weight:700}.strip-lab span{position:absolute;transform:translateX(-50%)}.strip-lab span[style*="right:0"]{transform:none}.strip-lab span:last-child{transform:none}
.wf{position:relative;width:42%}.wf i{position:absolute;top:4px;height:10px;border-radius:2px}.run{color:var(--ink-soft);width:36px}.th{margin:0 0 8px;font:700 17px var(--serif)}`;
async function draw(name, html, clip) {
  await page.evaluate(() => document.querySelector("#ov")?.remove());
  await page.evaluate(([c, h]) => { const st = document.createElement("style"); st.textContent = c; document.head.append(st); const d = document.createElement("div"); d.id = "ov"; d.innerHTML = h; document.body.append(d); }, [CSS, html]);
  await page.waitForTimeout(200);
  const h = await page.evaluate(() => Math.ceil(Math.max(...[...document.querySelectorAll("#ov .bs")].map((e) => e.getBoundingClientRect().bottom)) + 20));
  await shot(page, name, { clip: { x: 0, y: 0, width: clip, height: Math.min(1100, h) }, final: true });
}
console.log("busy", busy.attacker.value, busy.defender.value, busy.die, total(busy), busy.score, busy.grade, "| three", three.map((b) => [b.attackerFactionId, b.die, total(b), b.score, b.grade]).join(" / "));
const cap = (t) => `<div><p class="th">${t}</p>`;
await draw("5-ledger-options", `${cap("A (recommended) Ledger: simple fight")}${ledger(2, simple)}</div>${cap("B Running total: busy fight")}${waterfall(6, busy)}</div>`, 900);
await draw("5-ledger-busy", `${cap("A Ledger: busy fight, with the air battle")}${ledger(6, busy, { air })}</div>${cap("A Ledger: three-sided (second attacker)")}${ledger(4, three[1] ?? three[0])}</div>`, 900);
// Phone: one column, collapsible.
const ph = `<div style="width:380px">${ledger(6, busy, { air }).replace('class="two"', 'class="two" style="grid-template-columns:1fr"').replace('class="bs"', 'class="bs" style="width:376px"')}</div>`;
await draw("5-ledger-phone", ph, 420);
await browser.close();
