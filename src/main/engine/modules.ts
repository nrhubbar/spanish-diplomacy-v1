import { airModules } from "./modules/air";
import { economyModules } from "./modules/economy";
import { movementModules } from "./modules/movement";
import { partitionModules } from "./modules/partition";
import { recruitmentModules } from "./modules/recruitment";
import { weatherModules } from "./modules/weather";
import type { RuleHooks } from "./hooks";
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
  /** Answers to the cross-area questions (`hooks.ts`), collected across every selected module. */
  readonly hooks?: RuleHooks;
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

/** The engine's own modules, one file per area under `modules/`; each slice edits only its area's file. */
const builtIns: readonly RuleModule[] = [
  ...economyModules,
  ...recruitmentModules,
  ...weatherModules,
  ...movementModules,
  ...partitionModules,
  ...airModules
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
