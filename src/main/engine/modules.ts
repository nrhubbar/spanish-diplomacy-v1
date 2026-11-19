import { rollWeather } from "./phases/00-weather";
import { flyAirMissions } from "./phases/02-air";
import { moveInTransit } from "./phases/03-transit";
import { fightMeetings } from "./phases/04-meetings";
import { fightBattles } from "./phases/05-battles";
import { settleOccupation } from "./phases/06-occupation";
import { fightStandingBattles } from "./phases/07-standing";
import { updateControl } from "./phases/08-control";
import { updateMorale } from "./phases/09-morale";
import { advanceQueues } from "./phases/10-training";
import { collectIncome } from "./phases/11-income";
import type { Phase } from "./phases/draft";
import { type RuleArea, ruleAreas } from "./types";

/**
 * The rule module registry and the plugin interface (E2, E3, E5). A module is a named rule set
 * for one area: the scenario data blocks it reads (the loader requires them, L15) and its parts
 * of the turn's steps (section 2). A scenario's `plugin.ts` registers modules through this same
 * interface and may do nothing else.
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

/** The turn's steps, in order (section 2). Steps 1 (reveal) and 12 (victory) are the engine's own. */
export const turnSteps = [
  "weather",
  "reveal",
  "air",
  "transit",
  "meetings",
  "battles",
  "occupation",
  "standing",
  "control",
  "morale",
  "training",
  "income",
  "victory"
] as const;
export type TurnStep = (typeof turnSteps)[number];

export interface RuleModule {
  readonly area: RuleArea;
  readonly blocks: readonly ScenarioBlock[];
  readonly id: string;
  /** The module's part of each step it takes part in. Steps run modules in `ruleAreas` order. */
  readonly steps: Partial<Readonly<Record<TurnStep, Phase>>>;
}

/** What a scenario's `plugin.ts` exports as `plugin`. */
export interface ScenarioPlugin {
  readonly modules: readonly RuleModule[];
}

export interface ModuleRegistry {
  /** The module names known for an area (L14). */
  known(area: RuleArea): ReadonlySet<string>;
  /** A registered module; throws for an unknown name, which the loader has already ruled out. */
  require(area: RuleArea, id: string): RuleModule;
}

// Today's rules, which the presets run (declog D3).
const d6Steps = { battles: fightBattles, meetings: fightMeetings, morale: updateMorale, standing: fightStandingBattles };
const singleStepSteps = { transit: moveInTransit };
const partitionSteps = { control: updateControl, occupation: settleOccupation };

/**
 * The engine's own modules. The first of each area is the `m2-strength` preset. Until its slice
 * lands, each Milestone 3 module runs its area's preset steps plus pass-through skeletons, so
 * selecting it changes nothing: TODO(m3r1-d20-combat) `d20-graded`, TODO(m3r1-movement-rail-ports)
 * `allowance`, TODO(m3r1-sub-territories) `provinces`, TODO(m3r1-economy-builds) `development`,
 * TODO(m3r1-recruit-replenish) `buildings`, TODO(m3r1-weather-timer) `seasonal-zones`,
 * TODO(m3r1-air-generals) `missions`.
 */
const builtIns: readonly RuleModule[] = [
  { area: "dice", blocks: [], id: "d6-table", steps: d6Steps },
  { area: "dice", blocks: ["d20"], id: "d20-graded", steps: d6Steps },
  { area: "economy", blocks: [], id: "none", steps: {} },
  { area: "economy", blocks: ["subTerritories", "resources", "development", "buildings", "improvements"], id: "development", steps: { income: collectIncome, training: advanceQueues } },
  { area: "recruitment", blocks: [], id: "none", steps: {} },
  { area: "recruitment", blocks: ["subTerritories", "resources", "buildings", "recruitment"], id: "buildings", steps: { training: advanceQueues } },
  { area: "weather", blocks: [], id: "none", steps: {} },
  { area: "weather", blocks: ["weather", "calendar"], id: "seasonal-zones", steps: { weather: rollWeather } },
  { area: "movement", blocks: [], id: "single-step", steps: singleStepSteps },
  { area: "movement", blocks: ["subTerritories", "movement"], id: "allowance", steps: singleStepSteps },
  { area: "partition", blocks: [], id: "none", steps: partitionSteps },
  { area: "partition", blocks: ["subTerritories"], id: "provinces", steps: partitionSteps },
  { area: "air", blocks: [], id: "none", steps: {} },
  { area: "air", blocks: ["air"], id: "missions", steps: { air: flyAirMissions } }
];

/** A registry of the built-in modules plus those the plugins register. A name may be registered once per area. */
export function createModuleRegistry(plugins: readonly ScenarioPlugin[] = []): ModuleRegistry {
  const modules = new Map<string, RuleModule>();
  for (const module of [...builtIns, ...plugins.flatMap((plugin) => plugin.modules)]) {
    const key = `${module.area}:${module.id}`;
    if (modules.has(key)) throw new Error(`The ${module.area} module "${module.id}" is registered twice.`);
    modules.set(key, module);
  }
  return {
    known: (area) => new Set([...modules.values()].filter((module) => module.area === area).map((module) => module.id)),
    require: (area, id) => {
      const module = modules.get(`${area}:${id}`);
      if (module === undefined) throw new Error(`Invariant violated: unknown ${area} module "${id}".`);
      return module;
    }
  };
}

export const builtInModuleRegistry = createModuleRegistry();

/** The modules a selection names, in `ruleAreas` order. */
export function selectModules(registry: ModuleRegistry, rules: Readonly<Record<RuleArea, string>>): readonly RuleModule[] {
  return ruleAreas.map((area) => registry.require(area, rules[area]));
}
