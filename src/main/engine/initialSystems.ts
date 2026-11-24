import type { FactionId, GameState, GeneralsState, Resources, Scenario, SubTerritoryId, SubTerritoryState } from "./types";

type SystemState = Omit<GameState, "cityControl" | "control" | "fortification" | "turnNumber" | "units">;

/**
 * The Milestone 3 part of the starting state: sub-territories at their start holders (P1) and
 * 1936 data, starting treasuries ($7), and empty training, reveals and raid cuts. A
 * scenario without a system leaves its collections empty. The weather is rolled by phase 0, not here.
 */
export function initialSystems(scenario: Scenario): SystemState {
  const subTerritories: Record<SubTerritoryId, SubTerritoryState> = {};
  for (const sub of scenario.subTerritories) {
    subTerritories[sub.id] = {
      buildings: sub.buildings,
      development: sub.development,
      holder: sub.startHolder,
      port: sub.port,
      queue: [],
      rail: sub.rail
    };
  }
  const treasuries: Record<FactionId, Resources> = {};
  const generals: Record<FactionId, GeneralsState> = {};
  for (const faction of scenario.factions) {
    if (faction.startingStock !== undefined) treasuries[faction.id] = faction.startingStock;
    if (scenario.generals.length > 0) generals[faction.id] = { nextIndex: 0, pending: [] };
  }
  return { generals, raidCuts: [], raised: {}, reveals: [], subTerritories, training: [], treasuries };
}
