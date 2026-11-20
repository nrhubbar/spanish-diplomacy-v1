import type { BattleDice } from "../main/engine/dice";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import {
  type D6BattleOutcome,
  isD6Battle,
  type CityId,
  type FactionId,
  type GameState,
  type MoveOrder,
  type PlayerSubmission,
  type Scenario,
  type ScenarioId,
  type TerritoryId,
  type TurnResolutionResult,
  type UnitDefinition,
  type UnitId,
  type UnitState,
  type UnitTypeDefinition,
  type UnitTypeId
} from "../main/engine/types";
import { builtInModuleRegistry } from "../main/engine/modules";
import { builtInSources } from "../main/scenarios/builtInSources";
import { createScenarioRegistry, type ScenarioRegistry } from "../main/scenarios/registry";
import { createAppStore } from "../main/state/store";
import { fixtureSources } from "./fixtures/scenarios/fixtureSources";

export const spainId = "spanish-civil-war-1936" as ScenarioId;
export const tinyId = "tiny-front" as ScenarioId;

let sharedRegistry: ScenarioRegistry | undefined;
let shipped: ScenarioRegistry | undefined;

/** Registry with every shipped package, as shipped, plus test fixtures. */
export function shippedRegistry(): ScenarioRegistry {
  shipped ??= createScenarioRegistry(builtInSources, fixtureSources);
  return shipped;
}

/**
 * Spain on the d6 preset's dice. The Milestone 2 rule and report tests were written against
 * Spain's map with the d6 table; they keep testing it (declog D3's intent), while Spain ships
 * with `d20-graded` (`spainD20`).
 */
export function onD6Dice(scenario: Scenario): Scenario {
  return {
    ...scenario,
    modules: scenario.modules.map((module) => (module.area === "dice" ? builtInModuleRegistry.require("dice", "d6-table") : module)),
    rules: { ...scenario.rules, dice: "d6-table" }
  };
}

/** Registry with every shipped package plus test fixtures; Spain is pinned to the d6 table (`onD6Dice`). */
export function testRegistry(): ScenarioRegistry {
  if (sharedRegistry === undefined) {
    const registry = shippedRegistry();
    const pinned = { ...registry.require(spainId), scenario: onD6Dice(registry.require(spainId).scenario) };
    sharedRegistry = { ...registry, list: () => registry.list(), loadAssets: (id) => registry.loadAssets(id), peekAssets: (id) => registry.peekAssets(id), require: (id) => (id === spainId ? pinned : registry.require(id)) };
  }
  return sharedRegistry;
}

/** Spain on the d6 table, for the Milestone 2 rule tests. */
export function spain(): Scenario {
  return testRegistry().require(spainId).scenario;
}

/** Spain as shipped, on the d20 (D1-D8). */
export function spainD20(): Scenario {
  return shippedRegistry().require(spainId).scenario;
}

export function tiny(): Scenario {
  return testRegistry().require(tinyId).scenario;
}

export const faction = (id: string): FactionId => id as FactionId;
export const territory = (id: string): TerritoryId => id as TerritoryId;
export const unit = (id: string): UnitId => id as UnitId;
export const city = (id: string): CityId => id as CityId;

export function move(factionId: string, unitId: string, from: string, to: string): MoveOrder {
  return { factionId: faction(factionId), from: territory(from), kind: "move", to: territory(to), unitId: unit(unitId) };
}

/** Strength given to synthetic test armies whose ids are not in the scenario. */
export const syntheticStrength = 100;

export function withUnits(scenario: Scenario, units: readonly (readonly [string, string, string])[]): GameState {
  const base = initialGameState(scenario);
  const record: Record<UnitId, UnitState> = {};
  for (const [id, factionId, territoryId] of units) {
    record[unit(id)] = {
      factionId: faction(factionId),
      fatigue: 0,
      id: unit(id),
      morale: { demoralized: false, quietTurns: 0 },
      strength: scenario.index.units.get(unit(id))?.strength ?? syntheticStrength,
      territoryId: territory(territoryId)
    };
  }
  return { ...base, units: record };
}

/** The army's state, failing the test when it is absent. */
export function armyIn(state: GameState, id: string): UnitState {
  const found = state.units[unit(id)];
  if (found === undefined) throw new Error(`No army "${id}" in this state.`);
  return found;
}

export function testStore(preloadedState?: Parameters<typeof createAppStore>[0]["preloadedState"]) {
  return createAppStore({ registry: testRegistry(), ...(preloadedState === undefined ? {} : { preloadedState }) });
}

/** One army for `battlefield`. Synthetic ids get a definition of the given type and strength. */
export interface ArmySpec {
  readonly demoralized?: boolean;
  readonly faction: string;
  readonly fullStrength?: number;
  readonly id: string;
  readonly strength?: number;
  readonly territory: string;
  readonly type?: string;
}

/**
 * A scenario and state holding exactly the given armies. Armies whose ids the scenario lacks
 * are added to it (type "foot" by default, 100 men at full strength), so they can fight.
 */
export function battlefield(
  base: Scenario,
  armies: readonly ArmySpec[],
  options: { readonly state?: Partial<GameState>; readonly types?: readonly UnitTypeDefinition[] } = {}
): { readonly scenario: Scenario; readonly state: GameState } {
  const unitTypes = [...base.unitTypes, ...(options.types ?? [])];
  const known = new Map(base.units.map((definition) => [definition.id, definition]));
  const definitions: UnitDefinition[] = armies.map((spec) => {
    const existing = known.get(unit(spec.id));
    const fullStrength = spec.fullStrength ?? existing?.fullStrength ?? syntheticStrength;
    return {
      factionId: faction(spec.faction),
      formationKind: "regiment",
      fullStrength,
      id: unit(spec.id),
      name: existing?.name ?? `Army ${spec.id}`,
      sources: [],
      strength: fullStrength,
      territoryId: territory(spec.territory),
      type: (spec.type ?? existing?.type ?? base.unitTypes[0]?.id ?? "foot") as UnitTypeId
    };
  });
  const scenario: Scenario = {
    ...base,
    index: {
      ...base.index,
      unitTypes: new Map(unitTypes.map((type) => [type.id, type])),
      units: new Map([...base.units, ...definitions].map((definition) => [definition.id, definition]))
    },
    unitTypes,
    units: [...base.units.filter((definition) => !definitions.some((added) => added.id === definition.id)), ...definitions]
  };
  const start = initialGameState(base);
  const units: Record<UnitId, UnitState> = {};
  for (const spec of armies) {
    const fullStrength = spec.fullStrength ?? known.get(unit(spec.id))?.fullStrength ?? syntheticStrength;
    units[unit(spec.id)] = {
      factionId: faction(spec.faction),
      fatigue: 0,
      id: unit(spec.id),
      morale: { demoralized: spec.demoralized ?? false, quietTurns: 0 },
      strength: spec.strength ?? fullStrength,
      territoryId: territory(spec.territory)
    };
  }
  return { scenario, state: { ...start, units, ...options.state } };
}

export const unitType = (id: string, attack: number, defence: number): UnitTypeDefinition =>
  ({ attack, defence, effects: [], id: id as UnitTypeId, kind: "ground", name: id, orders: ["move"] });

/**
 * Loaded dice: battle `i` rolls `faces[i]`. Draws after the die (standing-battle tie-breaks)
 * return `rest[i]` when given, else 0, which picks the first tied faction.
 */
export function loadedDice(faces: readonly number[], rest: readonly number[] = []): BattleDice {
  return (index) => {
    const face = faces[index];
    if (face === undefined) throw new Error(`No loaded face for battle ${String(index)}.`);
    let draws = 0;
    return () => {
      draws += 1;
      return draws === 1 ? (face - 0.5) / 6 : rest[index] ?? 0;
    };
  };
}

/** One submission per faction, in first-seen order, so tests can list orders flat. */
export function submissionsOf(orders: readonly MoveOrder[]): readonly PlayerSubmission[] {
  const byFaction = new Map<string, MoveOrder[]>();
  for (const order of orders) byFaction.set(order.factionId, [...(byFaction.get(order.factionId) ?? []), order]);
  return [...byFaction].map(([factionId, factionOrders]) => ({ factionId: faction(factionId), orders: factionOrders }));
}

/** Resolves flat orders with loaded dice (or seed 1 when none are given). */
export function play(scenario: Scenario, state: GameState, orders: readonly MoveOrder[], dice?: BattleDice): TurnResolutionResult {
  return resolveTurn(scenario, state, submissionsOf(orders), 1, dice);
}

export function battlesOf(result: TurnResolutionResult): readonly D6BattleOutcome[] {
  return result.outcomes.filter(isD6Battle);
}
