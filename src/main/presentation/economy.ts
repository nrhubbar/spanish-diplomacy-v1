import { currentLevel, maxLevel, projectCost, queuedLevel } from "../engine/economy/catalogue";
import type { BuildingEffect, BuildProject, Resources, Scenario, SubTerritoryState } from "../engine/types";

/**
 * Words for the economy ($1-$5): amounts, projects and building effects. Resources are named
 * from the scenario, never from code.
 */

/** "6 Funds and 1 Manpower"-style list; zeros left out; "nothing" when empty. */
export function amountText(scenario: Scenario, amount: Resources, separator = " · "): string {
  const parts = scenario.resources.flatMap((resource) => {
    const value = amount[resource.id] ?? 0;
    return value === 0 ? [] : [`${String(value)} ${resource.name}`];
  });
  return parts.length === 0 ? "nothing" : parts.join(separator);
}

/** "+6 Funds · +1 Manpower"; zeros left out; "nothing" when empty. */
export function signedAmountText(scenario: Scenario, amount: Resources): string {
  const parts = scenario.resources.flatMap((resource) => {
    const value = amount[resource.id] ?? 0;
    return value === 0 ? [] : [`${value > 0 ? "+" : "−"}${String(Math.abs(value))} ${resource.name}`];
  });
  return parts.length === 0 ? "nothing" : parts.join(" · ");
}

/** A whole number with its sign, using a true minus: "+14", "−3", "+0". */
export function signed(value: number): string {
  return value < 0 ? `−${String(-value)}` : `+${String(value)}`;
}

/** The project's base name: the building, the track, Rail or Port. */
export function projectBaseName(scenario: Scenario, project: BuildProject): string {
  switch (project.kind) {
    case "building":
      return scenario.index.buildings.get(project.buildingId)?.name ?? project.buildingId;
    case "development":
      return scenario.index.development.get(project.developmentId)?.name ?? project.developmentId;
    case "improvement":
      return project.improvement === "rail" ? "Rail" : "Port";
  }
}

/** A project as the queue shows it: "Factory", or "Farms 1 → 2" for a level after those queued ahead. */
export function projectName(scenario: Scenario, site: SubTerritoryState | undefined, project: BuildProject, levelBefore?: number): string {
  const base = projectBaseName(scenario, project);
  if (project.kind === "building" || site === undefined) return base;
  const from = levelBefore ?? queuedLevel(site, project);
  return `${base} ${String(from)} → ${String(from + 1)}`;
}

/** What a building effect does, in a few words. */
export function buildingEffectText(effect: BuildingEffect): string {
  switch (effect.kind) {
    case "recruit-slots":
      return `+${String(effect.extra)} recruit a turn`;
    case "replenish-rate":
      return `+${String(Math.round(effect.share * 100))}% replenishment`;
    case "replenish-cap":
      return `+${String(Math.round(effect.share * 100))}% replenishment cap`;
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
  return types.length === 0 ? undefined : `recruits ${types.slice(0, 3).join(", ")}${types.length > 3 ? "…" : ""}`;
}

/** What finishing the project gives: yield, effects, or what it unlocks. */
export function projectEffectText(scenario: Scenario, project: BuildProject): string | undefined {
  switch (project.kind) {
    case "development": {
      const track = scenario.index.development.get(project.developmentId);
      return track === undefined ? undefined : `+${String(track.yieldPerLevel)} ${scenario.resources.find((resource) => resource.id === track.resource)?.name ?? track.resource} a turn`;
    }
    case "improvement":
      return project.improvement === "rail" ? "longer rail moves" : "lands more armies";
    case "building": {
      const building = scenario.index.buildings.get(project.buildingId);
      if (building === undefined) return undefined;
      const parts = [...building.effects.map(buildingEffectText), ...(unlocksText(scenario, building.id) === undefined ? [] : [unlocksText(scenario, building.id) ?? ""])];
      return parts.length === 0 ? undefined : parts.join(", ");
    }
  }
}

/** "8 Funds · 2 turns · +1 Manpower a turn": a queue option's line. */
export function projectTerms(scenario: Scenario, project: BuildProject): string {
  const cost = projectCost(scenario, project);
  if (cost === undefined) return "";
  const effect = projectEffectText(scenario, project);
  const turns = `${String(cost.turns)} ${cost.turns === 1 ? "turn" : "turns"}`;
  return [amountText(scenario, cost.cost), turns, ...(effect === undefined ? [] : [effect])].join(" · ");
}

/** Levels for pips: the current level and the most it can reach. */
export function levelsOf(scenario: Scenario, site: SubTerritoryState, project: BuildProject): { readonly level: number; readonly max: number } {
  return { level: currentLevel(site, project), max: maxLevel(scenario, project) };
}

/** "2 turns left" for a queue item. */
export function turnsLeftText(turnsLeft: number): string {
  return `${String(turnsLeft)} ${turnsLeft === 1 ? "turn" : "turns"} left`;
}
