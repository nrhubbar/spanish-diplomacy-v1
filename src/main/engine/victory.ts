import type {
  FactionId,
  GameState,
  ScenarioDefinition,
  VictoryProgress,
  VictoryResult
} from "./types";

export function victoryProgress(
  scenario: ScenarioDefinition,
  state: GameState
): readonly VictoryProgress[] {
  const eligibleTerritories = scenario.territories.filter((territory) => territory.countsForVictory);
  const eligibleCities = scenario.cities.filter((city) => city.countsForVictory);
  const territoryThreshold = Math.ceil(eligibleTerritories.length * 0.51);
  const cityThreshold = Math.ceil(eligibleCities.length * 0.75);

  return scenario.factions.map((faction) => ({
    citiesControlled: eligibleCities.filter((city) => state.cityControl[city.id] === faction.id).length,
    cityThreshold,
    factionId: faction.id,
    territoriesControlled: eligibleTerritories.filter((territory) => {
      const control = state.control[territory.id];
      return control.kind === "controlled" && control.factionId === faction.id;
    }).length,
    territoryThreshold
  }));
}

export function evaluateVictory(progress: readonly VictoryProgress[]): VictoryResult | undefined {
  const qualifying = progress.filter(
    (entry) =>
      entry.territoriesControlled >= entry.territoryThreshold ||
      entry.citiesControlled >= entry.cityThreshold
  );

  if (qualifying.length === 0) {
    return undefined;
  }

  const bestCities = Math.max(...qualifying.map((entry) => entry.citiesControlled));
  const cityLeaders = qualifying.filter((entry) => entry.citiesControlled === bestCities);
  const bestTerritories = Math.max(...cityLeaders.map((entry) => entry.territoriesControlled));
  const winners = cityLeaders.filter((entry) => entry.territoriesControlled === bestTerritories);
  const factionIds = winners.map((entry) => entry.factionId);

  if (factionIds.length > 1) {
    return { condition: "shared", factionIds };
  }

  const winner = winners[0] as VictoryProgress;
  const condition =
    winner.citiesControlled >= winner.cityThreshold ? "cities" : "territories";

  return { condition, factionIds: factionIds as readonly FactionId[] };
}
