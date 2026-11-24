#!/usr/bin/env node
/**
 * Reads the shipped scenario and writes tools/econ-data.json for the economy widgets.
 * Run from anywhere: node tools/extract.mjs
 * Everything under "today" is read from scenario.json. "proposals" are this ideation's design
 * inputs; they are the only numbers typed by hand.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const scenarioPath = resolve(here, "../../../../src/scenarios/spanish-civil-war-1936/scenario.json");
const s = JSON.parse(readFileSync(scenarioPath, "utf8"));

const byId = (list) => new Map(list.map((x) => [x.id, x]));
const types = byId(s.unitTypes);
const tracks = byId(s.development);
const buildings = byId(s.buildings);
const round = (n) => Math.round(n * 1000) / 1000;

/** What one sub-territory's development pays a turn. */
function yieldOf(sub) {
  const total = { funds: 0, manpower: 0 };
  for (const [track, level] of Object.entries(sub.development ?? {})) {
    const t = tracks.get(track);
    total[t.resource] += level * t.yieldPerLevel;
  }
  return total;
}
const add = (a, b) => ({ funds: a.funds + b.funds, manpower: a.manpower + b.manpower });

const territories = s.territories.map((t) => {
  const subs = s.subTerritories.filter((x) => x.territoryId === t.id);
  const holders = {};
  for (const x of subs) holders[x.startHolder] = (holders[x.startHolder] ?? 0) + 1;
  const ids = Object.keys(holders);
  const capital = subs.find((x) => x.id === t.capitalSubTerritoryId);
  const slots = s.recruitment.maxPerTerritory + (capital?.buildings ?? []).reduce((n, b) => n + (buildings.get(b)?.effects ?? []).reduce((m, e) => m + (e["@type"] === "recruit-slots" ? e["@data"].extra : 0), 0), 0);
  // "Settled": a contested territory goes to the side holding more than half its sub-territories; ties pay nobody.
  const [leader] = ids.sort((a, b) => holders[b] - holders[a]);
  const levels = {};
  for (const x of subs) for (const [track, level] of Object.entries(x.development ?? {})) levels[track] = (levels[track] ?? 0) + level;
  return {
    id: t.id,
    name: t.name,
    holders,
    contested: ids.length > 1,
    holder: ids.length === 1 ? ids[0] : null,
    settledHolder: holders[leader] * 2 > subs.length ? leader : null,
    yield: subs.map(yieldOf).reduce(add, { funds: 0, manpower: 0 }),
    levels,
    capitalHolder: capital?.startHolder ?? null,
    capitalBuildings: capital?.buildings ?? [],
    slots,
    cities: s.cities.filter((c) => c.territoryId === t.id).length
  };
});

const factions = s.factions.map((f) => {
  const held = territories.filter((t) => t.holder === f.id);
  const settled = territories.filter((t) => t.settledHolder === f.id);
  const army = {};
  let men = 0;
  for (const u of s.units.filter((x) => x.factionId === f.id)) {
    const type = types.get(u.type);
    if (type.kind === "general") continue;
    const entry = (army[u.type] ??= { count: 0, men: 0 });
    entry.count += 1;
    entry.men += u.strength;
    men += u.strength;
  }
  // Upgrades a faction could queue on the first turn: whole-held sites, buildable, under the cap.
  const upgrades = {};
  for (const track of s.development) {
    upgrades[track.id] = s.subTerritories.filter((x) => held.some((t) => t.id === x.territoryId) && x.buildable.includes(track.id) && (x.development?.[track.id] ?? 0) < track.maxLevel).length;
  }
  const sum = (list) => list.map((t) => t.yield).reduce(add, { funds: 0, manpower: 0 });
  return {
    id: f.id,
    name: f.name,
    abbreviation: f.abbreviation,
    stock: f.startingStock,
    income: sum(held),
    incomeSettled: sum(settled),
    territories: held.map((t) => t.id),
    cities: s.cities.filter((c) => c.initialController === f.id).length,
    slots: held.reduce((n, t) => n + t.slots, 0),
    slotsWithBarracks: held.filter((t) => t.capitalBuildings.includes("barracks")).reduce((n, t) => n + t.slots, 0),
    army,
    men,
    upgrades,
    industryLevels: held.reduce((n, t) => n + (t.levels.industry ?? 0), 0),
    industryLevelsSettled: settled.reduce((n, t) => n + (t.levels.industry ?? 0), 0)
  };
});

const units = s.unitTypes.filter((t) => t.recruit !== undefined).map((t) => ({
  id: t.id,
  name: t.name,
  kind: t.kind,
  foot: t.foot === true,
  attack: t.attack,
  defence: t.defence,
  funds: t.recruit.cost.funds ?? 0,
  manpower: t.recruit.cost.manpower ?? 0,
  establishment: t.recruit.establishment,
  train: t.recruit.trainingTurns,
  requires: t.recruit.requires,
  factionIds: t.recruit.factionIds ?? null,
  abilities: [...(t.effects ?? []).map((e) => e["@type"]), ...(t.air?.missions ?? []).map((m) => `mission:${m}`)]
}));

const effectText = {
  "recruit-slots": (d) => `+${d.extra} recruit a turn`,
  "replenish-discount": (d) => `Replenish costs ${d.share * 100}% less ${d.resource}`,
  "defence-roll": (d) => `${d.roll} off the attacker's roll`,
  "replenish-cap": (d) => `Replenish cap +${d.share * 100}%`,
  airbase: () => "aircraft can base here",
  "all-weather-airbase": () => "flies in mud and snow",
  "rail-departures": (d) => `+${d.extra} army by rail a turn`
};

const projects = [
  ...s.development.map((x) => ({ id: x.id, name: x.name, group: "development", funds: x.upgrade.cost.funds ?? 0, manpower: x.upgrade.cost.manpower ?? 0, turns: x.upgrade.turns, resource: x.resource, yield: x.yieldPerLevel, cityOnly: x.cityOnly === true })),
  ...s.buildings.map((x) => ({ id: x.id, name: x.name, group: "building", funds: x.cost.funds ?? 0, manpower: x.cost.manpower ?? 0, turns: x.turns, effect: (x.effects ?? []).map((e) => (effectText[e["@type"]] ?? (() => e["@type"]))(e["@data"] ?? {})).join("; ") || "unlocks units", unlocks: units.filter((u) => u.requires.includes(x.id)).map((u) => u.name) })),
  ...["rail", "port"].map((id) => ({ id, name: id === "rail" ? "Rail repair" : "Port", group: "improvement", funds: s.improvements[id].cost.funds ?? 0, manpower: 0, turns: s.improvements[id].turns, effect: id === "rail" ? "+1 station level" : "+1 port level" })),
  ...Object.entries(s.linkProjects).filter(([k]) => k !== "note").map(([id, x]) => ({ id, name: { "new-rail": "New rail line", "rail-upgrade": "Rail upgrade", "road-upgrade": "Road upgrade" }[id] ?? id, group: "link", funds: x.cost.funds ?? 0, manpower: 0, turns: x.turns, effect: "one link" }))
];

/* ---- proposals (design inputs, hand-typed) ---- */
const works = {
  // Labour works: part of the price moves from Funds to Manpower, so a side rich in men and poor in money has something to build.
  fortifications: { funds: 3, manpower: 2, effect: "2 off the attacker's roll" },
  rail: { funds: 3, manpower: 1, turns: 2 },
  "road-upgrade": { funds: 3, manpower: 2 },
  "rail-upgrade": { funds: 5, manpower: 3, turns: 3 },
  "new-rail": { funds: 10, manpower: 6, turns: 5 }
};
const commonUnits = {
  "infantry-regiment": { funds: 5 },
  "militia-column": { funds: 3, attack: 2 },
  "colonial-veterans": { funds: 7 },
  "security-forces": { funds: 4, manpower: 1, establishment: 1000, train: 1 },
  "artillery-group": { funds: 7, train: 2 },
  "cavalry-regiment": { funds: 4 },
  "tank-company": { funds: 10, attack: 5, defence: 3, train: 3 },
  "truck-column": { funds: 4 },
  "anti-air-battery": { funds: 5 },
  "recon-flight": { funds: 5, train: 2 },
  "fighter-squadron": { funds: 8 },
  "bomber-squadron": { funds: 10 }
};
const ownerUnits = Object.fromEntries(`infantry-regiment,5,1,0.25,4,6,2
militia-column,3,3,1.5,2,5,1
colonial-veterans,7,2,0.25,6,6,2
security-forces,5,1,0.75,2,6,1
artillery-group,6,1,0.1,2,3,2
cavalry-regiment,4,1,0.3,3,3,2
tank-company,8,1,0.15,5,3,3
truck-column,3,1,0.1,0,0,1
anti-air-battery,5,1,0.15,0,1,2
recon-flight,5,1,0.05,0,1,2
fighter-squadron,6,1,0.05,0,1,3
bomber-squadron,7,1,0.05,0,1,3`.split("\n").map((row) => {
  const [id, funds, manpower, upkeepM, attack, defence, train] = row.split(",");
  return [id, { funds: +funds, manpower: +manpower, upkeepM: +upkeepM, attack: +attack, defence: +defence, train: +train }];
}));
const commonProjects = {
  farms: { funds: 3, turns: 2 }, mines: { funds: 5, turns: 2 }, industry: { funds: 6, turns: 2 },
  barracks: { funds: 5 }, factory: { funds: 10, manpower: 4, turns: 3 }, depot: { funds: 6 }, hospital: { funds: 5 },
  airfield: { funds: 6, turns: 2 }, "paved-airfield": { funds: 4 }, "rail-yard": { funds: 6, turns: 2 }, port: { funds: 6, turns: 2 },
  ...works
};
const proposals = {
  measured: {
    name: "Moderate",
    note: "Numbers only, plus one upkeep rule. Recommended.",
    upkeep: { share: 0.5, free: 6, machineFunds: 0, lossCap: 0.1, floor: 0.5 },
    barricades: 2,
    popularResistance: 0,
    alarm: { critical: 3, perStep: 1.5, steps: 3 },
    units: commonUnits,
    projects: commonProjects
  },
  // Round 2: the owner's unit table (owner-answers-round-1.md), verbatim, with Moderate's buildings.
  owner: {
    name: "Your table",
    note: "The owner's unit table, its upkeep per unit, and Moderate's building prices.",
    upkeep: { share: 0, free: 0, machineFunds: 0, lossCap: 0.1, floor: 0.5 },
    barricades: 2,
    popularResistance: 0,
    alarm: { critical: 3, perStep: 1.5, steps: 3 },
    units: ownerUnits,
    projects: commonProjects
  },
  bold: {
    name: "Bold",
    note: "Moderate, with double the upkeep rate and a Funds upkeep for machines, so Manpower runs short for everyone.",
    upkeep: { share: 1, free: 12, machineFunds: 0.5, lossCap: 0.1, floor: 0.5 },
    barricades: 2,
    popularResistance: 0,
    alarm: { critical: 3, perStep: 1.5, steps: 3 },
    units: { ...commonUnits, "artillery-group": { funds: 6, train: 2 }, "fighter-squadron": { funds: 8, train: 2 }, "bomber-squadron": { funds: 10, train: 2 } },
    projects: { ...commonProjects, barracks: { funds: 5, turns: 1 } }
  }
};

const pr = s.d20.factionModifiers.find((m) => m.id === "popular-resistance");
// Round 3: Industry and Factory merged into one Factory per city, paying 1.5 Funds. A city has one if it has either today.
const mergedIncome = (factionId, settled) => territories.filter((t) => (settled ? t.settledHolder : t.holder) === factionId).reduce((sum, t) => {
  const factories = s.subTerritories.filter((x) => x.territoryId === t.id && ((x.development?.industry ?? 0) > 0 || (x.buildings ?? []).includes("factory"))).length;
  return { funds: sum.funds + t.yield.funds - (t.levels.industry ?? 0) + 1.5 * factories, manpower: sum.manpower + t.yield.manpower };
}, { funds: 0, manpower: 0 });
const merged = Object.fromEntries(s.factions.map((f) => {
  const open = s.subTerritories.filter((x) => (x.buildable ?? []).includes("industry") && !((x.development?.industry ?? 0) > 0 || (x.buildings ?? []).includes("factory")));
  const own = (x, key) => territories.find((t) => t.id === x.territoryId)?.[key] === f.id;
  return [f.id, { start: mergedIncome(f.id, false), settled: mergedIncome(f.id, true), sites: open.filter((x) => own(x, "settledHolder")).length, sitesNow: open.filter((x) => own(x, "holder")).length }];
}));

const data = {
  merged,
  source: "src/scenarios/spanish-civil-war-1936/scenario.json",
  victory: { territoryShare: s.victory.territoryShare, cityShare: s.victory.cityShare, territories: s.territories.filter((t) => t.countsForVictory).length, cities: s.cities.filter((c) => c.countsForVictory).length },
  alarm: s.ai.profiles.north.victoryAlarm,
  aiBuilds: s.ai.profiles.north.builds,
  recruitment: { maxPerTerritory: s.recruitment.maxPerTerritory, replenishCostShare: s.recruitment.replenishCostShare, replenishShare: s.recruitment.replenishShare },
  d20: {
    worksPerTurn: s.d20.modifiers.worksPerTurn,
    worksMax: s.d20.modifiers.worksMax,
    barricades: s.d20.modifiers.barricades,
    belowOneToOnePenalty: s.d20.modifiers.belowOneToOnePenalty,
    popularResistance: pr?.defence ?? 0,
    table: s.d20.table.map((row) => row.map((id) => s.d20.grades.findIndex((g) => g.id === id))),
    grades: s.d20.grades.map((g) => ({ name: g.name, take: g.ground === "all", gain: g.ground !== 0, attackerLoss: g.attacker.lossPercent, defenderLoss: g.defender.lossPercent }))
  },
  development: s.development.map((t) => ({ id: t.id, yieldPerLevel: t.yieldPerLevel, maxLevel: t.maxLevel })),
  territories,
  factions,
  units,
  projects,
  // Lengths quoted from earlier sims (cited in research/economy.md).
  gameLength: { ownerMax: 10, medianLow: 12, medianHigh: 15 },
  upkeepPresets: [
    { id: "none", name: "No upkeep (today)", kind: "none", rate: 0, free: 0 },
    { id: "flat", name: "Flat: 1 per ground unit", kind: "flat", rate: 1, free: 0 },
    { id: "men", name: "By men actually under arms", kind: "men", rate: 0.5, free: 0 },
    { id: "share", name: "By full size of the unit type, first 6 free (recommended)", kind: "share", rate: 0.5, free: 6 },
    { id: "split", name: "Manpower by size, Funds for machines", kind: "split", rate: 0.5, free: 6, machineFunds: 0.5 },
    { id: "softcap", name: "Supply limit: 3 units per whole territory, then 1 each", kind: "softcap", rate: 1, perTerritory: 3, free: 0 }
  ],
  proposals
};
data.territories.forEach((t) => { t.yield = { funds: round(t.yield.funds), manpower: round(t.yield.manpower) }; });

writeFileSync(resolve(here, "econ-data.json"), JSON.stringify(data, null, 1) + "\n");
console.log(factions.map((f) => `${f.id}: stock ${f.stock.funds}/${f.stock.manpower}, income ${f.income.funds}/${f.income.manpower}, settled ${f.incomeSettled.funds}/${f.incomeSettled.manpower}, slots ${f.slots}, upgrades ${JSON.stringify(f.upgrades)}, industry ${f.industryLevels}`).join("\n"));
