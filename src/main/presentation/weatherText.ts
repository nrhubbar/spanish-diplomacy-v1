import type { FrostbiteOutcome, GameState, Scenario, TerritoryId, TimeRanOutOutcome, WeatherId } from "../engine/types";
import { forecast, zoneOf } from "../engine/weather";
import { glyphs } from "./glyphs";
import { factionName, territoryName, unitName } from "./text";

/** T6: "Republican Government's time ran out: 3 units held." */
export function describeTimeRanOut(scenario: Scenario, outcome: TimeRanOutOutcome): string {
  const count = outcome.heldUnitCount;
  const held = count === 0 ? "every unit had an order" : `${String(count)} ${count === 1 ? "unit" : "units"} held`;
  return `${factionName(scenario, outcome.factionId)}'s time ran out: ${held}.`;
}

/** T4: "Durruti Column lost 125 men to frostbite in Arag\u00f3n." */
export function describeFrostbite(scenario: Scenario, outcome: FrostbiteOutcome): string {
  const name = unitName(scenario, outcome.unitId);
  const where = territoryName(scenario, outcome.territoryId);
  return outcome.destroyed === true
    ? `${name} lost ${String(outcome.men)} men to frostbite in ${where} and broke up.`
    : `${name} lost ${String(outcome.men)} men to frostbite in ${where}.`;
}

/** One outcome of a forecast as the route card shows it, with the separator before it. */
export interface ForecastEntry {
  readonly lead: string;
  readonly text: string;
  readonly weatherId: WeatherId;
}

/**
 * T3: next turn's two likeliest outcomes at a destination ("Next turn: Rain 30% \u00b7 Clear 55%"),
 * none without weather in play there.
 */
export function forecastEntries(scenario: Scenario, state: Pick<GameState, "turnNumber" | "weather">, territoryId: TerritoryId): readonly ForecastEntry[] {
  const zone = zoneOf(scenario, territoryId);
  if (zone === undefined || state.weather === undefined) return [];
  return forecast(scenario, zone.id, state.turnNumber + 1).slice(0, 2).map(({ chance, outcome }, index) => ({
    lead: index === 0 ? " " : ` ${glyphs.dot} `,
    text: ` ${outcome.name} ${String(Math.round(chance * 100))}%`,
    weatherId: outcome.id
  }));
}
