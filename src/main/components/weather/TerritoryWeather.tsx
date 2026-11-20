import type { JSX } from "react";
import type { GameState, Scenario, TerritoryId } from "../../engine/types";
import { forecast, zoneOf } from "../../engine/weather";
import { glyphs } from "../../presentation/glyphs";
import { WeatherChip } from "./WeatherChip";
import { WeatherIcon } from "./WeatherIcon";

/** How many of next turn's likeliest outcomes the forecast names. */
const forecastShown = 2;

/**
 * T3: the territory pane's weather: this turn's pill, then next turn's odds as a forecast
 * ("Next: Clear 60% · Rain 30%"), from the zone's table for next turn's season.
 */
export function TerritoryWeather({ scenario, state, territoryId }: { readonly scenario: Scenario; readonly state: GameState; readonly territoryId: TerritoryId }): JSX.Element | null {
  const zone = zoneOf(scenario, territoryId);
  if (zone === undefined || state.weather === undefined) return null;
  const next = forecast(scenario, zone.id, state.turnNumber + 1).slice(0, forecastShown);
  return (
    <p aria-label={`Weather in the ${zone.name} zone`} className="territory-weather">
      <WeatherChip scenario={scenario} state={state} territoryId={territoryId} />
      {next.length === 0 ? null : (
        <span className="weather-forecast">
          <span>Next:</span>
          {next.map(({ chance, outcome }, index) => (
            <span className="forecast-entry" key={outcome.id}>
              {index === 0 ? null : <span aria-hidden="true">{` ${glyphs.dot} `}</span>}
              <WeatherIcon weatherId={outcome.id} />
              {`${outcome.name} ${String(Math.round(chance * 100))}%`}
            </span>
          ))}
        </span>
      )}
    </p>
  );
}
