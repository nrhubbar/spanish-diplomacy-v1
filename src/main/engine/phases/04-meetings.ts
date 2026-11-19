import { resolveMeetings } from "../meeting";
import type { Phase } from "./draft";

/** Step 4 (M20): head-on meeting battles, on final steps only. */
export const fightMeetings: Phase = (draft) => {
  const meetings = resolveMeetings(draft.input.scenario, draft.armies, draft.orders.advances, draft.input.dice);
  return { ...draft, armies: meetings.armies, meetings };
};
