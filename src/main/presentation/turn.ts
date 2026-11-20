import { dateLabel, turnDate } from "../engine/calendar";
import type { Scenario } from "../engine/types";
import { glyphs } from "./glyphs";

/**
 * T1: "Turn 7 · Late October 1936" wherever the turn is shown, when the scenario has a
 * calendar. Without one (B15), the snapshot date describes the start only. Kept apart from
 * `text.ts` so the screens in the initial chunk (the handoff) do not pull the report text and
 * flavor lines in with it.
 */
export function turnLabel(scenario: Scenario, turnNumber: number): string {
  const turn = `Turn ${String(turnNumber)}`;
  if (scenario.calendar !== undefined) return `${turn} ${glyphs.dot} ${dateLabel(turnDate(scenario.calendar, turnNumber))}`;
  return turnNumber === 1 ? `${turn} ${glyphs.dot} ${scenario.snapshotLabel}` : turn;
}
