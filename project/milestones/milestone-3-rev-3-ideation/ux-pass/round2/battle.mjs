// Item 5: the battle report's p.battle-score becomes the owner's ledger, inside the real report cards
// (seed 42, recorded battles). "Who fought" is worked out from the start-of-turn state and checked
// against the recorded unit value, because the engine keeps only the value.
import { browser, newPage, start, css, shot, sheet, sc } from "./lib2.mjs";
import { engine } from "./engine.mjs";
const CSS = `.battle-ledger{display:grid;gap:.35rem;margin:.2rem 0 .3rem;font-variant-numeric:tabular-nums}
.battle-ledger-die .d20-face{width:2.9rem;height:2.9rem;font-size:1.15rem}.battle-ledger-die{margin:0}
.battle-ledger h5{margin:.1rem 0 0;font:750 .86rem var(--sans)}
.battle-ledger table{width:100%;border-collapse:collapse;font-size:.84rem}
.battle-ledger th{font-weight:400;text-align:left;padding:.16rem 0;border-bottom:1px solid var(--paper-deep)}
.battle-ledger td{text-align:right;font-weight:800;border-bottom:1px solid var(--paper-deep);padding:.16rem 0;white-space:nowrap}
.battle-ledger td.pos{color:#276221}.battle-ledger td.neg{color:#9a2f14}
.battle-ledger tfoot th,.battle-ledger tfoot td{border-bottom:0;border-top:1.5px solid var(--ink);font-weight:800;padding-top:.28rem}
.battle-outcome{margin:.1rem 0 .25rem;font:700 1rem var(--sans)}.battle-outcome strong{font:700 1.35rem var(--serif)}.battle-outcome small{font-weight:400;color:var(--ink-soft);font-size:.82rem}
.who-fought{margin-top:.4rem;border:1px solid var(--rule);border-radius:8px;background:rgb(255 255 255/45%);font-size:.8rem}
.who-fought summary{padding:.4rem .6rem;font-weight:700;cursor:pointer}.who-fought table{width:100%;border-collapse:collapse}
.who-fought th,.who-fought td{padding:.2rem .6rem;text-align:left;font-weight:400;border-top:1px solid var(--paper-deep);vertical-align:top}.who-fought thead th{font-weight:700;color:var(--ink-soft);font-size:.74rem}.who-fought .n{text-align:right;font-weight:800;white-space:nowrap}.who-fought td.m{white-space:nowrap}
.who-fought tr.side th{font-weight:750;background:var(--paper-deep)}.who-fought small{display:block;color:var(--ink-soft);font-size:.78rem}.who-fought small b{font-weight:400}.who-fought small .bad,.who-fought .bad{color:#9a2f14;font-weight:700}`;
const CASES = [
  { key: "simple", turn: 2, at: "aragon", by: "north" },
  { key: "clamp", turn: 4, at: "extremadura", by: "south" },
  { key: "busy", turn: 6, at: "castilla-la-mancha", by: "south" },
  { key: "who", turn: 3, at: "pais-vasco", by: "north", who: true }
];
for (const c of CASES) {
  const page = await newPage("desktop", { width: 1440, height: 2400 });
  await start(page, { orders2: true });
  let before;
  for (let t = 2; t <= c.turn; t += 1) {
    before = await page.evaluate(() => JSON.parse(JSON.stringify({ units: window.M3D.S().game.state.units, raised: window.M3D.S().game.state.raised })));
    await page.evaluate(() => window.M3D.d("game/endTurn")); await page.waitForTimeout(250);
    if (t < c.turn) { await page.evaluate(() => window.M3D.d("game/startNextTurn")); await page.waitForTimeout(150); }
  }
  await page.waitForTimeout(600); await engine(page); await css(page, CSS);
  for (let k = 0; k < 3; k += 1) await page.evaluate(() => document.querySelectorAll('.map-pane [aria-expanded="false"]').forEach((e) => { if (e.closest(".battle-card,[class*=battle]")) e.click(); }));
  await page.waitForTimeout(400);
  const info = await page.evaluate(({ c, before, gens }) => {
    const E = window.__eng, sc = window.__sc, S = window.M3D.S();
    const b = S.result.outcomes.find((o) => o.kind === "battle" && o.site.territoryId === c.at && o.attackerFactionId === c.by);
    const rolls = [...document.querySelectorAll(".battle-roll-d20")];
    const roll = rolls.find((r) => { const t = r.querySelector(".battle-score-sum").textContent; return t.startsWith(`d20 ${b.die}`) && new RegExp(`= ${b.score}(\\D|$)`).test(t) && b.modifiers.every((m) => t.includes(E.signed(m.roll))); });
    if (!roll) return { err: rolls.map((r) => r.querySelector(".battle-score-sum").textContent) };
    const gen = (id) => gens[id] ?? id;
    const name = (m) => m.kind === "general" ? `${gen(m.generalId)} commands` : m.kind === "trait" ? `${gen(m.generalId)} is ${m.traitId.replace(/-/g, " ")}` : m.kind === "air-support" ? `Ground Support, ${m.unitIds.length} aircraft` : m.kind === "dug-in" ? `Dug in, level ${m.level}` : E.termName(m, sc);
    const total = b.modifiers.reduce((s, m) => s + m.roll, 0), raw = b.die + total;
    const rows = b.modifiers.map((m) => `<tr><th scope="row">${name(m)}</th><td class="${m.roll > 0 ? "pos" : "neg"}">${E.signed(m.roll)}</td></tr>`).join("") || `<tr><th scope="row">No effects on this roll</th><td></td></tr>`;
    const el = document.createElement("div"); el.className = "battle-ledger";
    el.innerHTML = `<p class="battle-ledger-die"><span class="d20-face">${b.die}</span></p><h5>Effects on the roll:</h5><table><tbody>${rows}</tbody><tfoot><tr><th scope="row">Total</th><td>${E.signed(total)}</td></tr></tfoot></table><p class="battle-outcome">Outcome: <strong>${b.score}</strong>${raw === b.score ? "" : ` <small>(${E.signed(raw).replace("+", "")}, kept within 0 to 20)</small>`}</p>`;
    roll.querySelector(".battle-score").replaceWith(el);
    const check = [];
    if (c.who) {
      const line = (a) => { const u = before.units[a.unitId]; const def = before.raised[a.unitId] ?? sc.index.units.get(a.unitId); const type = sc.index.unitTypes.get(def.type); const base = a.role === "attack" ? type.attack : type.defence; return { name: def.name, men: u.strength, full: def.fullStrength, dem: u.morale.demoralized, base, value: a.value, calc: Math.max(1, Math.round(base * u.strength / def.fullStrength * (u.morale.demoralized ? .5 : 1))), general: type.kind === "general" || base === 0 }; };
      const side = (s, role, title) => `<tr class="side"><th colspan="2" scope="rowgroup">${title}: ${s.value}</th></tr>` + s.armies.map((a) => { const l = line({ ...a, role }); check.push([l.name, l.base, l.men, l.full, l.dem, l.calc, l.value]); return `<tr><th scope="row">${l.name}<small>${l.general ? "Commands, does not fight" : `${l.men.toLocaleString("en")} of ${l.full.toLocaleString("en")} men, <b class="${l.dem ? "bad" : ""}">${l.dem ? "demoralized (counts half)" : "steady"}</b>`}</small></th><td class="n">${l.general ? "\u2013" : l.value}</td></tr>`; }).join("");
      const d = document.createElement("details"); d.className = "who-fought"; d.open = true;
      const fn = (id) => sc.index.factions.get(id)?.name.replace(" Insurgent Command", "") ?? id;
      d.innerHTML = `<summary>Who fought</summary><table><thead><tr><th>Unit, men and morale</th><th class="n">Counted for</th></tr></thead><tbody>${side(b.attacker, "attack", `${fn(b.attackerFactionId)} attack`)}${side(b.defender, "defence", `${fn(b.defender.armies[0].factionId)} defence`)}</tbody></table>`;
      roll.append(d);
    }
    roll.dataset.shot = "1"; roll.scrollIntoView();
    roll.parentElement.style.padding = getComputedStyle(roll.parentElement).padding;
    return { mods: b.modifiers.map((m) => [name(m), m.roll]), total, raw, score: b.score, die: b.die, check, parent: [...document.querySelectorAll("[data-shot]")].map((e) => { const ps = []; for (let p = e; p && ps.length < 6; p = p.parentElement) ps.push(p.className); return ps; }) };
  }, { c, before, gens: Object.fromEntries(sc.generals.roster.map((g) => [g.id, g.name])) });
  console.log(c.key, JSON.stringify(info));
  await page.waitForTimeout(300);
  await page.evaluate(() => { const r = document.querySelector("[data-shot]"); const card = r?.closest("article, .battle-card, .battle-group, li, section"); if (card) card.dataset.card = "1"; });
  const loc = (await page.locator("[data-card]").count()) ? "[data-card]" : "[data-shot]";
  const h = await page.evaluate(() => { const e = document.querySelector("[data-card]"); return e && [e.className, Math.round(e.getBoundingClientRect().height)]; });
  console.log("card", JSON.stringify(h));
  await shot(page, `5-${c.key}`, { locator: "[data-shot]" });
  if (c.who) { await shot(page, "5-who-open", { locator: ".who-fought" }); await page.evaluate(() => { document.querySelector(".who-fought").open = false; }); await shot(page, "5-who-closed", { locator: "[data-shot]" }); }
  await page.context().close();
}
await sheet("5-battle-ledger", [
  { src: "5-simple", caption: ["Simple fight", "Aragón, turn 2"] },
  { src: "5-busy", caption: ["Busy fight", "Castilla-La Mancha, turn 6"] },
  { src: "5-clamp", caption: ["Kept within 0 to 20", "Extremadura, turn 4, under today's rules"] }], { gap: 28 });
await sheet("5-who-fought", [{ src: "5-who-closed", caption: ["Closed, below the bands", "País Vasco, turn 3"] }, { src: "5-who-open", caption: ["Opened (optional)", "Worked out from start-of-turn men"] }], { gap: 40 });
await browser.close();
