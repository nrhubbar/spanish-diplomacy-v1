import type { WeatherTurnOutcome } from "../../engine/types";

/**
 * Generic report lines for the weather outcomes. The turn report's Conditions section
 * (`screens/report/TurnConditions.tsx`) gives the full sentences with names.
 */
export const weatherLines: Readonly<Record<WeatherTurnOutcome["kind"], string>> = {
  frostbite: "A unit that moved in severe cold lost men to frostbite.",
  "time-ran-out": "A player's planning time ran out; their planned orders went in and the other units held.",
  "weather-rolled": "The turn's weather was rolled before planning."
};
