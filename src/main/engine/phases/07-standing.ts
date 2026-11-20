import { settleDepartures } from "../retreat";
import { resolveStanding } from "../standing";
import type { Phase } from "./draft";

/** Step 7 (M27): standing battles in shared territories, and their retreats (M21). */
export const fightStandingBattles: Phase = (draft) => {
  const { dice, scenario, start } = draft.input;
  const firstIndex = draft.meetings.battles.length + draft.front.battles.length;
  const standing = resolveStanding(scenario, start, draft.armies, dice, firstIndex, draft.scratch);
  const departures = settleDepartures(scenario, start, standing.armies, standing.leaving);
  return { ...draft, armies: departures.armies, settled: [...draft.settled, ...departures.settled], standing: standing.battles };
};
