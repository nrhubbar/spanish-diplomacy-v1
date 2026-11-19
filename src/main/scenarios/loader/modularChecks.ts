import type { ModuleRegistry, ScenarioBlock } from "../../engine/modules";
import { ruleAreas } from "../../engine/types";
import type { ModularScenarioDocument } from "../schema/scenarioSchema";
import { idSet, type Issues } from "./issues";
import { checkSubTerritories } from "./subTerritoryChecks";

/** Rules L14-L17 and L24 for `m3-modular` packages. */
export function checkModular(document: ModularScenarioDocument, issues: Issues, modules: ModuleRegistry): void {
  for (const area of ruleAreas) {
    const moduleId = document.rules[area];
    if (!modules.known(area).has(moduleId)) {
      issues.add(`rules.${area}: unknown ${area} module "${moduleId}" (L14)`);
      continue;
    }
    for (const block of modules.require(area, moduleId).blocks) {
      if (!hasBlock(document, block)) issues.add(`${block}: required by the ${area} module "${moduleId}" (L15)`);
    }
  }
  for (const name of ["subTerritories", "resources", "development", "buildings"] as const) issues.unique(name, document[name]);
  checkSubTerritories(document, issues);
  checkResources(document, issues);
  checkUnitTypes(document, issues);
  checkBases(document, issues);
}

/** L3: the sources every block and catalogue entry cites exist. */
function checkBases(document: ModularScenarioDocument, issues: Issues): void {
  const sources = idSet(document.sources);
  for (const name of ["factions", "unitTypes", "development", "buildings"] as const) {
    document[name].forEach((entry, index) => { issues.cited(`${name}[${String(index)}]`, entry, sources); });
  }
  for (const name of ["improvements", "recruitment", "movement", "d20", "weather", "calendar", "air", "generals"] as const) {
    issues.cited(name, document[name], sources);
  }
}

function hasBlock(document: ModularScenarioDocument, block: ScenarioBlock): boolean {
  const value = document[block];
  return Array.isArray(value) ? value.length > 0 : value !== undefined;
}

/** L24: every amount names a known resource, and with resources every faction has a starting stock. */
function checkResources(document: ModularScenarioDocument, issues: Issues): void {
  const resources = idSet(document.resources);
  const amounts = (path: string, record: Readonly<Record<string, number>>): void => {
    for (const id of Object.keys(record)) issues.ref(path, id, resources, "resource");
  };
  document.factions.forEach((faction, index) => {
    if (faction.startingStock !== undefined) amounts(`factions[${index}].startingStock`, faction.startingStock);
    else if (resources.size > 0) issues.add(`factions[${index}]: "${faction.id}" needs a startingStock (L24)`);
  });
  document.development.forEach((track, index) => {
    issues.ref(`development[${index}].resource`, track.resource, resources, "resource");
    amounts(`development[${index}].upgrade.cost`, track.upgrade.cost);
  });
  document.buildings.forEach((building, index) => { amounts(`buildings[${index}].cost`, building.cost); });
  if (document.improvements !== undefined) {
    amounts("improvements.rail.cost", document.improvements.rail.cost);
    amounts("improvements.port.cost", document.improvements.port.cost);
  }
  document.unitTypes.forEach((type, index) => {
    if (type.recruit !== undefined) amounts(`unitTypes[${index}].recruit.cost`, type.recruit.cost);
  });
}

/** L17: air types carry their range and missions and nothing else does; references resolve. */
function checkUnitTypes(document: ModularScenarioDocument, issues: Issues): void {
  const buildings = idSet(document.buildings);
  const factions = idSet(document.factions);
  const weather = idSet(document.weather?.outcomes ?? []);
  document.unitTypes.forEach((type, index) => {
    const path = `unitTypes[${index}]`;
    if ((type.kind === "air") !== (type.air !== undefined)) {
      issues.add(`${path}: "${type.id}" ${type.kind === "air" ? "needs" : "cannot have"} an air block (L17)`);
    }
    type.recruit?.requires.forEach((id) => { issues.ref(`${path}.recruit.requires`, id, buildings, "building"); });
    type.recruit?.factionIds?.forEach((id) => { issues.ref(`${path}.recruit.factionIds`, id, factions, "faction"); });
    type.effects.forEach((effect, effectIndex) => {
      if (effect.kind !== "roll-bonus-per-points") return;
      effect.exceptWeather.forEach((id) => { issues.ref(`${path}.effects[${effectIndex}].exceptWeather`, id, weather, "weather outcome"); });
    });
  });
}
