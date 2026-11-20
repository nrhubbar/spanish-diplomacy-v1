import type { JSX } from "react";
import type { GameState, Scenario, TerritoryId } from "../../engine/types";
import { weatherIn } from "../../engine/weather";
import { WeatherIcon } from "./WeatherIcon";

interface WeatherChipProps {
  readonly scenario: Scenario;
  readonly state: GameState;
  readonly territoryId: TerritoryId;
  /** Icon only, for tight spots such as odds plaques; the name stays for screen readers. */
  readonly iconOnly?: boolean;
}

/**
 * T3: a territory's weather this turn as a small chip: icon and name. Renders nothing without
 * weather. Exported for the destination rows (`m3r1-movement-rail-ports`) and the map's odds
 * plaques.
 */
export function WeatherChip({ iconOnly = false, scenario, state, territoryId }: WeatherChipProps): JSX.Element | null {
  const weather = weatherIn(scenario, state, territoryId);
  if (weather === undefined) return null;
  return (
    <span className="weather-chip" data-icon-only={iconOnly} data-weather={weather.id} title={weather.name}>
      <WeatherIcon weatherId={weather.id} />
      <span className={iconOnly ? "visually-hidden" : "weather-name"}>{weather.name}</span>
    </span>
  );
}
