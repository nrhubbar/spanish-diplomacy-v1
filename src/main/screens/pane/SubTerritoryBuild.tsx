import type { JSX } from "react";
import type { FactionId, GameState, Scenario, SubTerritoryId } from "../../engine/types";

export interface SubTerritoryBuildProps {
  readonly factionId: FactionId;
  readonly scenario: Scenario;
  readonly state: GameState;
  readonly subTerritoryId: SubTerritoryId;
}

/**
 * X3, X7: the focused sub-territory's card (development pips, buildings, the queue with progress
 * bars) and its "Add to the queue" list. A slot owned by `m3r1-economy-builds`; the focus view
 * (`SubTerritoryFocus`, `m3r1-sub-territories`) renders it below its header and summary.
 * TODO(m3r1-economy-builds): fill it; until then it renders nothing.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the slot's data, read once its slice lands
export function SubTerritoryBuild(_props: SubTerritoryBuildProps): JSX.Element | null {
  return null;
}
