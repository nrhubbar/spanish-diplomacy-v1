import type { JSX } from "react";
import type { GameState, Scenario, TerritoryId } from "../../engine/types";
import { glyphs } from "../../presentation/glyphs";
import { zoneForecast } from "../../presentation/weather";
import { WeatherChip } from "./WeatherChip";
import { WeatherIcon } from "./WeatherIcon";

/**
 * T3: the territory pane's weather: this turn's pill, then next turn's odds as a forecast
 * ("Next: Clear 60% · Rain 30%"), from the zone's table for next turn's season.
 */
export function TerritoryWeather({ scenario, state, territoryId }: { readonly scenario: Scenario; readonly state: GameState; readonly territoryId: TerritoryId }): JSX.Element | null {
  const zone = zoneForecast(scenario, state, territoryId);
  if (zone === undefined) return null;
  const { next } = zone;
  return (
    <span aria-label={`Weather in the ${zone.zoneName} zone`} className="territory-weather" role="group">
      <WeatherChip scenario={scenario} state={state} territoryId={territoryId} />
      {next.length === 0 ? null : (
        <span className="weather-forecast">
          <span>Next:</span>
          {next.map(({ text, weatherId }, index) => (
            <span className="forecast-entry" key={weatherId}>
              {index === 0 ? null : <span aria-hidden="true">{` ${glyphs.dot} `}</span>}
              <WeatherIcon weatherId={weatherId} />
              {text}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
