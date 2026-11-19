import { builtInModules, type RuleArea } from "./types";

/**
 * The rule module catalogue (E2, E5). Each module names the scenario data blocks it reads, so
 * the loader can require them (L15). TODO(m3r1-contract CP3): the registry and the plugin
 * interface join this catalogue.
 */

/** Scenario data blocks a module may need. */
export const scenarioBlocks = [
  "subTerritories",
  "resources",
  "development",
  "buildings",
  "improvements",
  "recruitment",
  "movement",
  "d20",
  "weather",
  "calendar",
  "air"
] as const;
export type ScenarioBlock = (typeof scenarioBlocks)[number];

/** The blocks each built-in module needs. Modules not listed need none. */
const builtInBlocks: Readonly<Record<string, readonly ScenarioBlock[]>> = {
  "d20-graded": ["d20"],
  development: ["subTerritories", "resources", "development", "buildings", "improvements"],
  buildings: ["subTerritories", "resources", "buildings", "recruitment"],
  "seasonal-zones": ["weather", "calendar"],
  allowance: ["subTerritories", "movement"],
  provinces: ["subTerritories"],
  missions: ["air"]
};

/** The module names known for an area. */
export function knownModules(area: RuleArea): ReadonlySet<string> {
  return new Set<string>(builtInModules[area]);
}

/** The blocks a module needs. */
export function moduleBlocks(moduleId: string): readonly ScenarioBlock[] {
  return builtInBlocks[moduleId] ?? [];
}
