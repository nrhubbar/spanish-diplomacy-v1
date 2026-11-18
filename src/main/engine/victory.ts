import type {
  FactionId,
  GameState,
  Scenario,
  VictoryCondition,
  VictoryProgress,
  VictoryResult
} from "./types";

export function victoryThresholds(scenario: Scenario): { readonly cities: number; readonly territories: number } {
  const territories = scenario.territories.filter((territory) => territory.countsForVictory).length;
  const cities = scenario.cities.filter((city) => city.countsForVictory).length;
  return {
    cities: Math.ceil(cities * scenario.victory.cityShare),
    territories: Math.ceil(territories * scenario.victory.territoryShare)
  };
}

export function victoryProgress(scenario: Scenario, state: GameState): readonly VictoryProgress[] {
  const thresholds = victoryThresholds(scenario);
  const eligibleTerritories = scenario.territories.filter((territory) => territory.countsForVictory);
  const eligibleCities = scenario.cities.filter((city) => city.countsForVictory);

  return scenario.factions.map((faction) => ({
    citiesControlled: eligibleCities.filter((city) => state.cityControl[city.id] === faction.id).length,
    cityThreshold: thresholds.cities,
    factionId: faction.id,
    territoriesControlled: eligibleTerritories.filter((territory) => {
      const control = state.control[territory.id];
      return control?.kind === "controlled" && control.factionId === faction.id;
    }).length,
    territoryThreshold: thresholds.territories
  }));
}

function meets(entry: VictoryProgress, condition: VictoryCondition): boolean {
  return condition === "cities"
    ? entry.citiesControlled >= entry.cityThreshold
    : entry.territoriesControlled >= entry.territoryThreshold;
}

function score(entry: VictoryProgress, condition: VictoryCondition): number {
  return condition === "cities" ? entry.citiesControlled : entry.territoriesControlled;
}

/**
 * A faction qualifies by meeting either threshold. Among qualifiers, the scenario's tie-break
 * order picks the leader; a tie that survives every tie-break is a shared victory.
 */
export function evaluateVictory(
  progress: readonly VictoryProgress[],
  tieBreak: readonly VictoryCondition[]
): VictoryResult | undefined {
  let leaders = progress.filter((entry) => meets(entry, "cities") || meets(entry, "territories"));
  if (leaders.length === 0) {
    return undefined;
  }

  for (const condition of tieBreak) {
    const best = Math.max(...leaders.map((entry) => score(entry, condition)));
    leaders = leaders.filter((entry) => score(entry, condition) === best);
  }

  const factionIds: readonly FactionId[] = leaders.map((entry) => entry.factionId);
  const [winner] = leaders;
  if (leaders.length > 1 || winner === undefined) {
    return { condition: "shared", factionIds };
  }
  const condition = tieBreak.find((candidate) => meets(winner, candidate))
    ?? (meets(winner, "cities") ? "cities" : "territories");
  return { condition, factionIds };
}
