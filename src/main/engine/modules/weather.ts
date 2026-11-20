import type { RuleModule } from "../modules";
import type { Phase } from "../phases/draft";

/** TODO(m3r1-weather-timer): one d20 from the `weather` stream, read against each zone's table (T2); a `weather-rolled` event. */
const rollWeather: Phase = (draft) => draft;

/** The weather area's modules (T1-T4). Pass-through parts until the slice lands. */
export const weatherModules: readonly RuleModule[] = [
  { area: "weather", blocks: [], id: "none", steps: {} },
  { area: "weather", blocks: ["weather", "calendar"], id: "seasonal-zones", steps: { weather: rollWeather } }
];
