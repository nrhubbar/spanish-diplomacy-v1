import { initialGameState } from "../main/engine/resolution";
import type {
  CityId,
  FactionId,
  GameState,
  MoveOrder,
  Scenario,
  ScenarioId,
  TerritoryId,
  UnitId,
  UnitState
} from "../main/engine/types";
import { builtInSources } from "../main/scenarios/builtInSources";
import { createScenarioRegistry, type ScenarioRegistry } from "../main/scenarios/registry";
import { createAppStore } from "../main/state/store";
import { fixtureSources } from "./fixtures/scenarios/fixtureSources";

export const spainId = "spain-1936-07-31" as ScenarioId;
export const tinyId = "tiny-front" as ScenarioId;

let sharedRegistry: ScenarioRegistry | undefined;

/** Registry with every shipped package plus test fixtures. */
export function testRegistry(): ScenarioRegistry {
  sharedRegistry ??= createScenarioRegistry(builtInSources, fixtureSources);
  return sharedRegistry;
}

export function spain(): Scenario {
  return testRegistry().require(spainId).scenario;
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

export function withUnits(scenario: Scenario, units: readonly (readonly [string, string, string])[]): GameState {
  const base = initialGameState(scenario);
  const record: Record<UnitId, UnitState> = {};
  for (const [id, factionId, territoryId] of units) {
    record[unit(id)] = { factionId: faction(factionId), id: unit(id), territoryId: territory(territoryId) };
  }
  return { ...base, units: record };
}

export function testStore(preloadedState?: Parameters<typeof createAppStore>[0]["preloadedState"]) {
  return createAppStore({ registry: testRegistry(), ...(preloadedState === undefined ? {} : { preloadedState }) });
}
