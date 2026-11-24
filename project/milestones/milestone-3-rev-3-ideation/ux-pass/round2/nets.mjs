import { browser, newPage, start } from "./lib2.mjs";
import { engine } from "./engine.mjs";
const RATE = { "infantry-regiment": .25, "militia-column": 1.5, "colonial-veterans": .25, "security-forces": .75, "artillery-group": .1, "cavalry-regiment": .3, "tank-company": .15, "truck-column": .1, "anti-air-battery": .15, "recon-flight": .05, "fighter-squadron": .05, "bomber-squadron": .05 };
const page = await newPage(); await start(page, { orders2: true }); await engine(page);
for (let t = 2; t <= 6; t += 1) {
  console.log(t, JSON.stringify(await page.evaluate(async (RATE) => {
    const inc = await import("/src/main/engine/economy/income.ts"); const st = window.M3D.S().game.state, S = window.__sc; const o = {};
    for (const f of ["republic", "north", "south"]) { let up = 0, n = 0; for (const u of Object.values(st.units)) { if (u.factionId !== f) continue; const k = (st.raised[u.id] ?? S.index.units.get(u.id)).type; up += RATE[k] ?? 0; n += 1; } const income = inc.incomeFor(S, st, f); o[f] = { n, stock: window.__eng.resources.treasuryOf(st, f), income, up: Math.round(up * 100) / 100 }; }
    return o;
  }, RATE)));
  await page.evaluate(() => window.M3D.d("game/endTurn")); await page.waitForTimeout(200); await page.evaluate(() => window.M3D.d("game/startNextTurn")); await page.waitForTimeout(150);
}
await browser.close();
