import type { WeatherTurnOutcome } from "../../engine/types";
import { weatherOutcome, weatherRules } from "../../engine/weather";
import { describeFrostbite, describeTimeRanOut } from "../weatherText";
import type { ReportLines } from "./lines";

/**
 * T2, T4, T6: the weather outcomes as report sentences. All are public. The turn report's
 * Conditions section (`screens/report/TurnConditions.tsx`) shows them with icons.
 */
export const weatherLines: ReportLines<WeatherTurnOutcome> = {
  frostbite: (outcome, { scenario }) => describeFrostbite(scenario, outcome),
  "time-ran-out": (outcome, { scenario }) => describeTimeRanOut(scenario, outcome),
  "weather-rolled": (outcome, { scenario }) => {
    const zones = (weatherRules(scenario)?.zones ?? []).flatMap((zone) => {
      const id = outcome.weather.outcomes[zone.id];
      const weather = id === undefined ? undefined : weatherOutcome(scenario, id);
      return weather === undefined ? [] : [`${zone.name} ${weather.name}`];
    });
    return zones.length === 0 ? `Turn ${String(outcome.turnNumber)}'s weather was rolled.` : `Weather on turn ${String(outcome.turnNumber)}: ${zones.join(", ")}.`;
  }
};
