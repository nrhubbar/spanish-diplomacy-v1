import type { GameState, Scenario, TerritoryId, WeatherOutcome, WeatherRolledOutcome } from "../engine/types";
import { forecast, weatherIn, weatherOutcome, weatherRules, zoneOf } from "../engine/weather";

/** T3: the weather as the chips, the pane's forecast and the turn report show it. */

/** This turn's weather in a territory. */
export function weatherAt(scenario: Scenario, state: GameState, territoryId: TerritoryId): WeatherOutcome | undefined {
  return weatherIn(scenario, state, territoryId);
}

/** How many of next turn's likeliest outcomes the forecast names. */
const forecastShown = 2;

export interface ZoneForecast {
  readonly next: readonly { readonly text: string; readonly weatherId: WeatherOutcome["id"] }[];
  readonly zoneName: string;
}

/** A territory's zone and its likeliest weather next turn, from the zone's table for that turn's season. */
export function zoneForecast(scenario: Scenario, state: GameState, territoryId: TerritoryId): ZoneForecast | undefined {
  const zone = zoneOf(scenario, territoryId);
  if (zone === undefined || state.weather === undefined) return undefined;
  return {
    next: forecast(scenario, zone.id, state.turnNumber + 1).slice(0, forecastShown)
      .map(({ chance, outcome }) => ({ text: `${outcome.name} ${String(Math.round(chance * 100))}%`, weatherId: outcome.id })),
    zoneName: zone.name
  };
}

/** The turn's weather rolls, "Centre: Rain", zone by zone. */
export function rolledWeather(scenario: Scenario, rolled: WeatherRolledOutcome): readonly { readonly text: string; readonly weatherId: WeatherOutcome["id"]; readonly zoneId: string }[] {
  return (weatherRules(scenario)?.zones ?? []).flatMap((zone) => {
    const id = rolled.weather.outcomes[zone.id];
    const weather = id === undefined ? undefined : weatherOutcome(scenario, id);
    return weather === undefined ? [] : [{ text: `${zone.name}: ${weather.name}`, weatherId: weather.id, zoneId: zone.id }];
  });
}
