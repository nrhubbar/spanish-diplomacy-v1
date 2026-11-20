import type { FactionId, GameState, Scenario } from "../../engine/types";

/** What every header slot is given: the visible state of the player at the screen. */
export interface HeaderSlotProps {
  readonly scenario: Scenario;
  /** Already filtered for the viewer (`visibleSession`). */
  readonly state: GameState;
  readonly viewer?: FactionId;
}
