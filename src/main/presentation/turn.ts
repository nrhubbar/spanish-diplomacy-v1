import type { Scenario } from "../engine/types";
import { glyphs } from "./glyphs";

/**
 * B15: the snapshot date describes the start only. Kept apart from `text.ts` so the screens in
 * the initial chunk (the handoff) do not pull the report text and flavor lines in with it.
 */
export function turnLabel(scenario: Scenario, turnNumber: number): string {
  return turnNumber === 1 ? `Turn 1 ${glyphs.dot} ${scenario.snapshotLabel}` : `Turn ${String(turnNumber)}`;
}
