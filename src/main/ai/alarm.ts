import type { AiProfile, FactionId, GameState, Scenario, VictoryProgress } from "../engine/types";
import { victoryProgress } from "../engine/victory";

/** How many captures short of victory a faction is: territories, or cities, of which a territory taken often brings two. */
export function stepsShort(entry: VictoryProgress): number {
  return Math.min(entry.territoryThreshold - entry.territoriesControlled, Math.ceil((entry.cityThreshold - entry.citiesControlled) / 2));
}

/** What a rival this many steps short of victory adds to the stakes of its ground, as a share of them. */
export function alarmAt(profile: AiProfile, steps: number): number {
  return Math.max(0, profile.victoryAlarm.steps - steps) * profile.victoryAlarm.perStep;
}

/** The rivals near enough to victory that the faction spends to stop them: `victoryAlarm.spendSteps` short, or fewer. */
export function pressingRivals(scenario: Scenario, state: GameState, factionId: FactionId, profile: AiProfile): ReadonlySet<FactionId> {
  return new Set(victoryProgress(scenario, state)
    .filter((entry) => entry.factionId !== factionId && stepsShort(entry) <= profile.victoryAlarm.spendSteps)
    .map((entry) => entry.factionId));
}
