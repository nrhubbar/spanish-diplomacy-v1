// The owner's upkeep rates on the real recorded units: totals per faction per turn (seed 42, no sims, the same recorded turns round 1 used).
import { browser, newPage, start, sc } from "./lib2.mjs";
import { engine } from "./engine.mjs";
export const RATE = { "infantry-regiment": .25, "militia-column": 1.5, "colonial-veterans": .25, "security-forces": .75, "artillery-group": .1, "cavalry-regiment": .3, "tank-company": .15, "truck-column": .1, "anti-air-battery": .15, "recon-flight": .05, "fighter-squadron": .05, "bomber-squadron": .05 };
const page = await newPage(); await start(page, { orders2: true }); await engine(page);
for (let t = 2; t <= 6; t += 1) {
  const r = await page.evaluate(({ RATE }) => {
    const st = window.M3D.S().game.state, S = window.__sc; const out = {};
    for (const u of Object.values(st.units)) { const def = st.raised[u.id] ?? S.index.units.get(u.id); if (!def) continue; const f = (out[u.factionId] ??= { types: {}, total: 0 }); const k = def.type; f.types[k] = (f.types[k] ?? 0) + 1; f.total += RATE[k] ?? 0; }
    return { out, treasury: st.treasury, weatherKeys: Object.keys(st).join(",") };
  }, { RATE });
  console.log(t, JSON.stringify(r.out), JSON.stringify(r.treasury), JSON.stringify(await page.evaluate(() => { try { const st = window.M3D.S().game.state; return Object.keys(st.factions ?? {}); } catch (e) { return String(e); } })));
  await page.evaluate(() => window.M3D.d("game/endTurn")); await page.waitForTimeout(200); await page.evaluate(() => window.M3D.d("game/startNextTurn")); await page.waitForTimeout(150);
}
await browser.close();
