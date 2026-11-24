// Finds the facts the mocks print: the real Andalucía estimate and every recorded battle's modifiers.
import { browser, newPage, start } from "./lib2.mjs";
import { engine } from "./engine.mjs";
const page = await newPage(); await start(page, { orders2: false });
await page.evaluate(() => { window.M3D.d("game/endTurn"); window.M3D.d("game/startNextTurn"); });
await page.waitForTimeout(400); await engine(page);
console.log(JSON.stringify(await page.evaluate(() => {
  const s = window.M3D.S(), st = s.game.state, E = window.__eng, sc = window.__sc;
  const v = E.muster(sc, st, "republic", "andalucia", "invade", { airOrders: [], orders: [] });
  const ids = v.groups.flatMap((g) => g.cards.map((c) => c.unitId)); const air = v.support.map((x) => x.unitId);
  const est = E.estimateAttack(sc, st, "republic", ids, "andalucia", air);
  const alone = v.groups.map((g) => [g.title, g.cards.length, E.estimateAttack(sc, st, "republic", g.cards.map((c) => c.unitId), "andalucia", []).modifiers?.map((m) => [m.kind, m.roll])]);
  return { mods: est.modifiers, air: est.air, take: est.takeChance, odds: est.oddsLabel, a: est.attacker.value, d: est.defender.value, works: st.fortification.andalucia, weather: st.weather?.current ?? Object.keys(st.weather ?? {}), alone, card: v.groups[0].cards[0], support: v.support };
}), null, 0));
const s2 = await newPage("desktop"); await start(s2, { orders2: true });
for (let t = 2; t <= 7; t += 1) {
  await s2.evaluate(() => window.M3D.d("game/endTurn")); await s2.waitForTimeout(250);
  const o = await s2.evaluate(() => window.M3D.S().result?.outcomes.filter((x) => x.kind === "battle").map((b) => [b.site.territoryId, b.attackerFactionId, b.attacker.value, b.defender.value, b.oddsLabel, b.die, b.score, b.grade, b.modifiers.map((m) => `${m.kind}${m.roll}`).join(" ")]));
  if (!o) break;
  for (const b of o) { const raw = b[5] + (b[8] ? b[8].split(" ").reduce((s, m) => s + Number(m.match(/-?\d+$/)[0]), 0) : 0); console.log(t, raw !== b[6] ? "CLAMP" + raw : "", b.join(" | ")); }
  await s2.evaluate(() => window.M3D.d("game/startNextTurn")); await s2.waitForTimeout(150);
}
await browser.close();
