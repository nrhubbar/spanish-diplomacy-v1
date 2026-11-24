import type { ScenarioDocument } from "../schema/scenarioSchema";
import type { Issues } from "./issues";

/**
 * L26 (P1, W6): with the `provinces` partition module, a territory's `initialControl` agrees with
 * its sub-territories' start holders (one holder: controlled by it; two or more: contested by
 * exactly them), and a city's `initialController` is its sub-territory's start holder. Control is
 * derived from the holders during play, so a disagreement would silently flip on turn 1.
 */
export function checkPartition(document: ScenarioDocument, issues: Issues): void {
  if (document.rules.partition !== "provinces" || document.subTerritories.length === 0) return;
  const holderOf = new Map(document.subTerritories.map((sub) => [sub.id, sub.startHolder]));
  document.territories.forEach((territory, index) => {
    const holders = new Set(document.subTerritories.filter((sub) => sub.territoryId === territory.id).map((sub) => sub.startHolder));
    if (holders.size === 0) return;
    const control = territory.initialControl;
    const stated = new Set(control.kind === "controlled" ? [control.factionId] : control.factionIds);
    const agrees = (control.kind === "controlled") === (holders.size === 1)
      && stated.size === holders.size && [...holders].every((id) => stated.has(id));
    if (!agrees) {
      issues.add(`territories[${String(index)}].initialControl: must match its sub-territories' start holders (${[...holders].join(", ")}) (L26)`);
    }
  });
  document.cities.forEach((city, index) => {
    const holder = city.subTerritoryId === undefined ? undefined : holderOf.get(city.subTerritoryId);
    if (holder !== undefined && city.initialController !== holder) {
      issues.add(`cities[${String(index)}].initialController: must be its sub-territory's start holder "${holder}" (L26)`);
    }
  });
}
