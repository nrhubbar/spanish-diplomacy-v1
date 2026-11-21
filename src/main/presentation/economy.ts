import { currentLevel, maxLevel, projectCost, queuedLevel } from "../engine/economy/catalogue";
import type { BuildingEffect, BuildProject, LinkWork, ResourceId, Resources, Scenario, SubTerritoryState } from "../engine/types";
import { glyphs } from "./glyphs";

/**
 * Words for the economy ($1-$5): amounts, projects and building effects. Resources are named
 * from the scenario, never from code, and read through their display scale (EB-12).
 */

const separator = ` ${glyphs.dot} `;

function displayOf(scenario: Scenario, resourceId: ResourceId) {
  return scenario.resources.find((resource) => resource.id === resourceId)?.display;
}

/** EB-12: an amount of one resource as the header shows it: "18k" for Manpower, "42" for Funds. */
export function resourceAmount(scenario: Scenario, resourceId: ResourceId, value: number): string {
  return `${String(value)}${displayOf(scenario, resourceId)?.suffix ?? ""}`;
}

/** EB-12: an amount with its sign, using a true minus: "+9k", "\u22123", "+0". */
export function signedResourceAmount(scenario: Scenario, resourceId: ResourceId, value: number): string {
  return value < 0 ? `${glyphs.minus}${resourceAmount(scenario, resourceId, -value)}` : `+${resourceAmount(scenario, resourceId, value)}`;
}

/** EB-12: an amount in full, points times the display unit: "18,000" for 18 Manpower, "42" for Funds. */
export function resourceAmountInFull(scenario: Scenario, resourceId: ResourceId, value: number): string {
  const full = value * (displayOf(scenario, resourceId)?.unit ?? 1);
  return String(full).replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
}

/** "6 Funds \u00b7 3k Manpower"-style list; zeros left out; "nothing" when empty. */
export function amountText(scenario: Scenario, amount: Resources, joiner = separator): string {
  const parts = scenario.resources.flatMap((resource) => {
    const value = amount[resource.id] ?? 0;
    return value === 0 ? [] : [`${resourceAmount(scenario, resource.id, value)} ${resource.name}`];
  });
  return parts.length === 0 ? "nothing" : parts.join(joiner);
}

/** "+6 Funds \u00b7 +1k Manpower"; zeros left out; "nothing" when empty. */
export function signedAmountText(scenario: Scenario, amount: Resources): string {
  const parts = scenario.resources.flatMap((resource) => {
    const value = amount[resource.id] ?? 0;
    return value === 0 ? [] : [`${signedResourceAmount(scenario, resource.id, value)} ${resource.name}`];
  });
  return parts.length === 0 ? "nothing" : parts.join(separator);
}

/** A whole number with its sign, using a true minus: "+14", "\u22123", "+0". */
export function signed(value: number): string {
  return value < 0 ? `${glyphs.minus}${String(-value)}` : `+${String(value)}`;
}

/** R7: the link works as the build lists name them. */
export const linkWorkNames: Readonly<Record<LinkWork, string>> = { "new-rail": "New rail line", "rail-upgrade": "Rail upgrade", "road-upgrade": "Road upgrade" };

/** The project's base name: the building, the track, Rail or Port, or the link work. */
export function projectBaseName(scenario: Scenario, project: BuildProject): string {
  switch (project.kind) {
    case "building":
      return scenario.index.buildings.get(project.buildingId)?.name ?? project.buildingId;
    case "development":
      return scenario.index.development.get(project.developmentId)?.name ?? project.developmentId;
    case "improvement":
      return project.improvement === "rail" ? "Rail" : "Port";
    case "link":
      return linkWorkNames[project.work];
  }
}

/** A project as the queue shows it: "Factory", or "Farms 1 \u2192 2" for a level after those queued ahead. */
export function projectName(scenario: Scenario, site: SubTerritoryState | undefined, project: BuildProject, levelBefore?: number): string {
  const base = projectBaseName(scenario, project);
  if (project.kind === "building" || project.kind === "link" || site === undefined) return base;
  const from = levelBefore ?? queuedLevel(site, project);
  return `${base} ${String(from)} ${glyphs.arrow} ${String(from + 1)}`;
}

/** What a building effect does, in a few words. */
export function buildingEffectText(scenario: Scenario, effect: BuildingEffect): string {
  switch (effect.kind) {
    case "recruit-slots":
      return `+${String(effect.extra)} recruit a turn`;
    case "replenish-cap":
      return `replenishes ${String(Math.round(effect.share * 100))}% more men a turn`;
    case "replenish-discount":
      return `replenishing costs ${String(Math.round(effect.share * 100))}% less ${scenario.resources.find((resource) => resource.id === effect.resource)?.name ?? effect.resource}`;
    case "rail-departures":
      return `+${String(effect.extra)} rail departure`;
    case "airbase":
      return "bases aircraft";
    case "all-weather-airbase":
      return "flies in Mud and Snow";
    case "defence-roll":
      return `+${String(effect.roll)} defence`;
  }
}

/** The buildings that a unit type's recruitment needs, as "needed to recruit Infantry, Cavalry". */
function unlocksText(scenario: Scenario, buildingId: string): string | undefined {
  const types = scenario.unitTypes.filter((type) => type.recruit?.requires.some((id) => id === buildingId) === true).map((type) => type.name);
  return types.length === 0 ? undefined : `recruits ${types.slice(0, 3).join(", ")}${types.length > 3 ? glyphs.ellipsis : ""}`;
}

/** What finishing the project gives: yield, effects, or what it unlocks. */
export function projectEffectText(scenario: Scenario, project: BuildProject): string | undefined {
  switch (project.kind) {
    case "development": {
      const track = scenario.index.development.get(project.developmentId);
      return track === undefined ? undefined : `${signedResourceAmount(scenario, track.resource, track.yieldPerLevel)} ${scenario.resources.find((resource) => resource.id === track.resource)?.name ?? track.resource} a turn`;
    }
    case "improvement":
      return project.improvement === "rail" ? "longer rail moves" : "lands more armies";
    case "link":
      return project.work === "road-upgrade" ? "a main road for trucks" : "longer rail moves";
    case "building": {
      const building = scenario.index.buildings.get(project.buildingId);
      if (building === undefined) return undefined;
      const parts = [...building.effects.map((effect) => buildingEffectText(scenario, effect)), ...(unlocksText(scenario, building.id) === undefined ? [] : [unlocksText(scenario, building.id) ?? ""])];
      return parts.length === 0 ? undefined : parts.join(", ");
    }
  }
}

/** "8 Funds \u00b7 2 turns \u00b7 +1k Manpower a turn": a queue option's line. */
export function projectTerms(scenario: Scenario, project: BuildProject): string {
  const cost = projectCost(scenario, project);
  if (cost === undefined) return "";
  const effect = projectEffectText(scenario, project);
  const turns = `${String(cost.turns)} ${cost.turns === 1 ? "turn" : "turns"}`;
  return [amountText(scenario, cost.cost), turns, ...(effect === undefined ? [] : [effect])].join(separator);
}

/** Levels for pips: the current level and the most it can reach. */
export function levelsOf(scenario: Scenario, site: SubTerritoryState, project: BuildProject): { readonly level: number; readonly max: number } {
  return { level: currentLevel(site, project), max: maxLevel(scenario, project) };
}

/** "2 turns left" for a queue item. */
export function turnsLeftText(turnsLeft: number): string {
  return `${String(turnsLeft)} ${turnsLeft === 1 ? "turn" : "turns"} left`;
}
