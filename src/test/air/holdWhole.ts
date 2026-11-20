import type { FactionId, GameState, Scenario, TerritoryId } from "../../main/engine/types";

/** W6, P7 in tests: the faction holds every sub-territory of the territory, and controls it. */
export function holdWhole(scenario: Scenario, state: GameState, territoryId: TerritoryId, factionId: FactionId): GameState {
  const subTerritories = { ...state.subTerritories };
  for (const sub of scenario.index.subTerritoriesByTerritory.get(territoryId) ?? []) {
    const current = subTerritories[sub.id];
    if (current !== undefined) subTerritories[sub.id] = { ...current, holder: factionId };
  }
  return { ...state, control: { ...state.control, [territoryId]: { factionId, kind: "controlled" } }, subTerritories };
}
