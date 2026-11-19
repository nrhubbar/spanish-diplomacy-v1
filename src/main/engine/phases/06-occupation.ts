import { settleDepartures } from "../retreat";
import type { Phase } from "./draft";

/**
 * Step 6 (M18, M21): returns, retreats and surrenders after the territory battles.
 * TODO(m3r1-sub-territories): sub-territory flips, the path rule, withdrawals (P3-P6).
 */
export const settleOccupation: Phase = (draft) => {
  const departures = settleDepartures(draft.input.scenario, draft.input.start, draft.armies, draft.front.leaving);
  return { ...draft, armies: departures.armies, settled: [...draft.settled, ...departures.settled] };
};
