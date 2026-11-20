import type { ModularScenarioDocument } from "../schema/scenarioSchema";
import { bandsCoverD20, idSet, type Issues } from "./issues";

/** Rules L20-L22 and L25: weather, generals, the d20 table and the raid table. */
export function checkSystems(document: ModularScenarioDocument, issues: Issues): void {
  checkWeather(document, issues);
  checkGenerals(document, issues);
  checkGeneralUnits(document, issues);
  checkD20(document, issues);
  if (document.air !== undefined && !bandsCoverD20(document.air.raidTable)) {
    issues.add("air.raidTable: bands must rise and end at 20 (L25)");
  }
}

/** L20: seasons cover the year once; every zone has a table per season; every territory names a zone. */
function checkWeather(document: ModularScenarioDocument, issues: Issues): void {
  const weather = document.weather;
  const zones = idSet(weather?.zones ?? []);
  document.territories.forEach((territory, index) => {
    if (territory.weatherZone !== undefined) issues.ref(`territories[${index}].weatherZone`, territory.weatherZone, zones, "weather zone");
    else if (weather !== undefined) issues.add(`territories[${index}]: "${territory.id}" needs a weatherZone (L20)`);
  });
  if (weather === undefined) return;
  issues.unique("weather.outcomes", weather.outcomes);
  issues.unique("weather.seasons", weather.seasons);
  issues.unique("weather.zones", weather.zones);
  const months = weather.seasons.flatMap((season) => season.months).sort((a, b) => a - b);
  if (months.join(",") !== "1,2,3,4,5,6,7,8,9,10,11,12") issues.add("weather.seasons: the seasons must cover each month once (L20)");
  const outcomes = idSet(weather.outcomes);
  weather.zones.forEach((zone, index) => {
    for (const season of weather.seasons) {
      const bands = zone.tables[season.id];
      if (bands === undefined) {
        issues.add(`weather.zones[${index}].tables: missing season "${season.id}" (L20)`);
        continue;
      }
      if (!bandsCoverD20(bands)) issues.add(`weather.zones[${index}].tables.${season.id}: bands must rise and end at 20 (L20)`);
      bands.forEach((band) => { issues.ref(`weather.zones[${index}].tables.${season.id}`, band.outcome, outcomes, "weather outcome"); });
    }
    for (const id of Object.keys(zone.tables)) {
      if (!weather.seasons.some((season) => season.id === id)) issues.ref(`weather.zones[${index}].tables`, id, new Set(), "season");
    }
  });
}

/** L21: traits resolve; each faction fields 3 to 5 generals and names a seat territory. */
function checkGenerals(document: ModularScenarioDocument, issues: Issues): void {
  const generals = document.generals;
  if (generals === undefined) return;
  issues.unique("generals.traits", generals.traits);
  issues.unique("generals.roster", generals.roster);
  const traits = idSet(generals.traits);
  const factions = idSet(document.factions);
  const territories = idSet(document.territories);
  const sources = idSet(document.sources);
  generals.roster.forEach((general, index) => {
    issues.ref(`generals.roster[${index}].trait`, general.trait, traits, "trait");
    issues.ref(`generals.roster[${index}].factionId`, general.factionId, factions, "faction");
    general.sources.forEach((source) => { issues.ref(`generals.roster[${index}].sources`, source.sourceId, sources, "source"); });
  });
  document.factions.forEach((faction, index) => {
    const count = generals.roster.filter((general) => general.factionId === faction.id).length;
    if (count < 3 || count > 5) issues.add(`generals.roster: "${faction.id}" has ${String(count)} generals; each faction needs 3 to 5 (L21)`);
    if (faction.seatTerritoryId === undefined) issues.add(`factions[${index}]: "${faction.id}" needs a seatTerritoryId (L21)`);
    else issues.ref(`factions[${index}].seatTerritoryId`, faction.seatTerritoryId, territories, "territory");
  });
}

/** L21: a unit of a general type is exactly one roster general of its own faction, and no other unit names one. */
function checkGeneralUnits(document: ModularScenarioDocument, issues: Issues): void {
  const roster = new Map((document.generals?.roster ?? []).map((general) => [general.id, general]));
  const generalTypes = new Set(document.unitTypes.filter((type) => type.kind === "general").map((type) => type.id));
  const fielded = new Set<string>();
  document.units.forEach((unit, index) => {
    const path = `units[${index}]`;
    if (unit.generalId === undefined) {
      if (generalTypes.has(unit.type)) issues.add(`${path}: "${unit.id}" is a general and needs a generalId (L21)`);
      return;
    }
    const general = roster.get(unit.generalId);
    if (general === undefined) issues.ref(`${path}.generalId`, unit.generalId, roster, "general");
    else if (general.factionId !== unit.factionId) issues.add(`${path}.generalId: "${unit.generalId}" serves another faction (L21)`);
    if (!generalTypes.has(unit.type)) issues.add(`${path}: only units of a general type name a generalId (L21)`);
    if (fielded.has(unit.generalId)) issues.add(`${path}.generalId: "${unit.generalId}" is fielded twice (L21)`);
    fielded.add(unit.generalId);
  });
}

/** L22: the table names known grades, and the fatigue and works numbers are in order. */
function checkD20(document: ModularScenarioDocument, issues: Issues): void {
  const d20 = document.d20;
  if (d20 === undefined) return;
  issues.unique("d20.grades", d20.grades);
  issues.unique("d20.factionModifiers", d20.factionModifiers);
  const grades = idSet(d20.grades);
  d20.table.forEach((column, columnIndex) => {
    column.forEach((grade, score) => { issues.ref(`d20.table[${columnIndex}][${score}]`, grade, grades, "grade"); });
  });
  const factions = idSet(document.factions);
  d20.factionModifiers.forEach((modifier, index) => { issues.ref(`d20.factionModifiers[${index}].factionId`, modifier.factionId, factions, "faction"); });
  if (d20.fatigue.fatiguedLevel >= d20.fatigue.demoralizedLevel) issues.add("d20.fatigue: fatiguedLevel must be below demoralizedLevel (L22)");
  if (d20.modifiers.worksPerTurn > d20.modifiers.worksMax) issues.add("d20.modifiers: worksPerTurn cannot exceed worksMax (L22)");
}
