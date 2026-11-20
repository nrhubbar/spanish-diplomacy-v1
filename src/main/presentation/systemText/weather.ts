import type { WeatherTurnOutcome } from "../../engine/types";

/** Placeholder report lines for the weather outcomes. TODO(m3r1-weather-timer): full sentences; owner: m3r1-weather-timer and m3r1-movement-rail-ports (frostbite). */
export const weatherLines: Readonly<Record<WeatherTurnOutcome["kind"], string>> = {
  frostbite: "A unit lost men to frostbite.",
  "time-ran-out": "A player's time ran out.",
  "weather-rolled": "The weather changed."
};
