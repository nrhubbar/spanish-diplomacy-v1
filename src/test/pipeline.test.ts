import { describe, expect, it } from "vitest";
import { battleStreamTag, rollStream, rollStreamTags, seededRollStreams } from "../main/engine/dice";
import { builtInModuleRegistry, createModuleRegistry, type RuleModule, turnSteps } from "../main/engine/modules";
import { weatherStep } from "../main/engine/phases/00-weather";
import { airStep } from "../main/engine/phases/02-air";
import { trainingStep } from "../main/engine/phases/10-training";
import { incomeStep } from "../main/engine/phases/11-income";
import { type Phase, startDraft } from "../main/engine/phases/draft";
import { deriveSeed, seededRandom } from "../main/engine/random";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import { builtInModules, ruleAreas, type SystemOutcome } from "../main/engine/types";
import { loadPackage, PackageValidationError } from "../main/scenarios/loader";
import { createScenarioRegistry } from "../main/scenarios/registry";
import { modularMap, modularScenario } from "./modularFixture";
import { faction, move, tiny } from "./support";

const assetPaths = new Set(["src/test/fixtures/scenarios/tiny-front/geometry.svg", "src/test/fixtures/scenarios/tiny-front/foot.svg"]);

/** A plugin air module that takes part in every step and records the order it ran in. */
function recordingModule(log: string[]): RuleModule {
  const steps = Object.fromEntries(turnSteps.map((step) => [step, (draft: Parameters<Phase>[0]) => {
    log.push(step);
    const event = { factionId: faction("red"), heldUnitCount: log.length, kind: "time-ran-out" } as SystemOutcome;
    return step === "income" ? { ...draft, events: [...draft.events, event] } : draft;
  }]));
  return { area: "air", blocks: [], id: "test-air", steps };
}

function modularWith(air: string, plugins: readonly { readonly modules: readonly RuleModule[] }[]) {
  const document = modularScenario();
  (document["rules"] as Record<string, string>)["air"] = air;
  return loadPackage({ assetPaths, mapDocument: modularMap(), mapPath: "m", modules: createModuleRegistry(plugins), scenarioDocument: document, scenarioPath: "s" }).scenario;
}

describe("the turn pipeline (section 2)", () => {
  it("runs every step in order, each selected module's part after the engine's own", () => {
    const log: string[] = [];
    const scenario = modularWith("test-air", [{ modules: [recordingModule(log)] }]);
    const result = resolveTurn(scenario, initialGameState(scenario), [], 1);
    expect(log).toEqual([...turnSteps]);
    expect(result.outcomes.at(-1)).toMatchObject({ heldUnitCount: 12, kind: "time-ran-out" });
  });

  it("keeps the Milestone 3 steps as pass-throughs until their slices land", () => {
    const scenario = tiny();
    const draft = startDraft({ dice: () => seededRandom(1), scenario, seed: 1, start: initialGameState(scenario), streams: seededRollStreams(1, 1), submissions: [] });
    for (const phase of [weatherStep, airStep, trainingStep, incomeStep]) expect(phase(draft)).toBe(draft);
    const presets = new Set(ruleAreas.flatMap((area) => Object.values(builtInModuleRegistry.require(area, builtInModules[area][0]).steps)));
    // Landed slices are no longer skeletons: dice (m3r1-d20-combat) and partition `provinces` (m3r1-sub-territories).
    const skeletons = ruleAreas.filter((area) => area !== "dice").flatMap((area) => Object.values(builtInModuleRegistry.require(area, builtInModules[area][1]).steps)).filter((part) => !presets.has(part))
      .filter((part) => !Object.values(builtInModuleRegistry.require("partition", "provinces").steps).includes(part));
    expect(skeletons.length).toBeGreaterThan(5);
    for (const part of skeletons) expect(part(draft)).toBe(draft);
  });

  it("plays a modular package exactly like its preset while the new modules are skeletons", () => {
    const preset = modularWith("none", []);
    const skeleton = modularWith("missions", []);
    const orders = [{ factionId: faction("red"), orders: [move("red", "red-guard", "westfold", "lowlands")] }];
    expect(resolveTurn(skeleton, initialGameState(skeleton), orders, 7)).toEqual(resolveTurn(preset, initialGameState(preset), orders, 7));
  });
});

describe("the module registry and plugins (E2, E3, E5)", () => {
  it("knows the engine's own modules, the presets first", () => {
    for (const area of ruleAreas) expect([...builtInModuleRegistry.known(area)]).toEqual([...builtInModules[area]]);
    expect(() => builtInModuleRegistry.require("air", "zeppelins")).toThrow("unknown air module");
  });

  it("accepts a plugin's module by name, and rejects the name without the plugin (L14)", () => {
    expect(modularWith("test-air", [{ modules: [recordingModule([])] }]).modules.map((module) => module.id)).toContain("test-air");
    expect(() => modularWith("test-air", [])).toThrow(PackageValidationError);
  });

  it("refuses a module registered twice, as a package problem", () => {
    const clash = { modules: [{ area: "dice", blocks: [], id: "d6-table", steps: {} } satisfies RuleModule] };
    expect(() => createModuleRegistry([clash])).toThrow("registered twice");
    const registry = createScenarioRegistry({
      maps: { "/x/map.json": modularMap() },
      plugins: { "/x/plugin.ts": clash },
      rawAssets: {},
      scenarios: { "/x/scenario.json": modularScenario() },
      urlAssets: {}
    });
    expect(registry.problems.map((problem) => problem.message).join("")).toContain("plugin: The dice module \"d6-table\" is registered twice.");
  });
});

describe("seeded streams per roll kind", () => {
  it("leaves the battle streams exactly where Milestone 2 had them", () => {
    expect(rollStreamTags.battle).toBe(battleStreamTag);
    expect(rollStream(42, "battle", 3, 2)()).toBe(seededRandom(deriveSeed(42, battleStreamTag, 3, 2))());
  });

  it("gives every kind its own stream", () => {
    const first = Object.keys(rollStreamTags).map((kind) => rollStream(42, kind as keyof typeof rollStreamTags, 3, 0)());
    expect(new Set(first).size).toBe(first.length);
    expect(seededRollStreams(42, 3)("weather", 1)()).toBe(rollStream(42, "weather", 3, 1)());
  });
});
