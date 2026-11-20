import type { JSX } from "react";
import { WeatherIcon } from "../../components/weather/WeatherIcon";
import type { FrostbiteOutcome, Scenario, TimeRanOutOutcome, TurnResolutionResult, WeatherId, WeatherRolledOutcome } from "../../engine/types";
import { weatherOutcome, weatherRules } from "../../engine/weather";
import { describeFrostbite, describeTimeRanOut } from "../../presentation/weatherText";

/**
 * The turn report's conditions (T2, T4, T6): whose time ran out and how many units held, the
 * weather the turn was fought in, and frostbite. Nothing renders when none of them happened.
 */
export function TurnConditions({ result, scenario }: { readonly result: TurnResolutionResult; readonly scenario: Scenario }): JSX.Element | null {
  const ranOut = result.outcomes.filter((outcome): outcome is TimeRanOutOutcome => outcome.kind === "time-ran-out");
  const frostbite = result.outcomes.filter((outcome): outcome is FrostbiteOutcome => outcome.kind === "frostbite");
  const rolled = result.outcomes.find((outcome): outcome is WeatherRolledOutcome => outcome.kind === "weather-rolled");
  const zones = weatherRules(scenario)?.zones ?? [];
  if (ranOut.length === 0 && frostbite.length === 0 && rolled === undefined) return null;
  return (
    <section aria-labelledby="conditions-title" className="pane-section turn-conditions">
      <h3 id="conditions-title">Conditions</h3>
      {ranOut.length === 0 ? null : (
        <ul className="time-ran-out-list">
          {ranOut.map((outcome) => <li key={outcome.factionId}>{describeTimeRanOut(scenario, outcome)}</li>)}
        </ul>
      )}
      {rolled === undefined ? null : (
        <ul aria-label="Weather this turn" className="weather-report">
          {zones.map((zone) => {
            const id: WeatherId | undefined = rolled.weather.outcomes[zone.id];
            const weather = id === undefined ? undefined : weatherOutcome(scenario, id);
            return weather === undefined ? null : (
              <li data-weather={weather.id} key={zone.id}>
                <WeatherIcon weatherId={weather.id} />
                <span>{`${zone.name}: ${weather.name}`}</span>
              </li>
            );
          })}
        </ul>
      )}
      {frostbite.length === 0 ? null : (
        <ul className="frostbite-list">
          {frostbite.map((outcome) => <li key={outcome.unitId}>{describeFrostbite(scenario, outcome)}</li>)}
        </ul>
      )}
    </section>
  );
}
