import type { Phase } from "./draft";

/**
 * Step 0 (T2, T3): the weather roll, read against each zone's seasonal table, and the forecast.
 * TODO(m3r1-weather-timer): roll from the `weather` stream and record `systems.weather` and a
 * `weather-rolled` event. Until then it passes the draft through unchanged.
 */
export const rollWeather: Phase = (draft) => draft;
