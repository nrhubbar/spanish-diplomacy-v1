import { resolveFront } from "../front";
import type { Phase } from "./draft";

/** Step 5 (M16-M19): battles in defended territories and in empty ones several factions enter. */
export const fightBattles: Phase = (draft) => {
  const { dice, scenario, start } = draft.input;
  const front = resolveFront(scenario, {
    armies: draft.armies,
    continuing: draft.meetings.continuing,
    dice,
    firstIndex: draft.meetings.battles.length,
    origins: draft.orders.origins,
    scratch: draft.scratch,
    start
  });
  return { ...draft, armies: front.armies, front };
};
