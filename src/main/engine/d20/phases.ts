import { settleDepartures } from "../retreat";
import type { Phase, TurnDraft } from "../phases/draft";
import type { GradedInput } from "./battle";
import { resolveGradedFront } from "./front";
import { resolveGradedMeetings } from "./meeting";
import { resolveGradedStanding } from "./standing";

/** The turn's weather as the battles read it: this turn's roll if step 0 made one, else the start's (CT-44). */
export function gradedInput(draft: TurnDraft): GradedInput {
  return { scratch: draft.scratch, start: draft.input.start, weather: draft.systems.weather ?? draft.input.start.weather };
}

/** Step 4 for `d20-graded` (M20). */
export const fightGradedMeetings: Phase = (draft) => {
  const meetings = resolveGradedMeetings(draft.input.scenario, gradedInput(draft), draft.armies, draft.orders.advances, draft.input.dice);
  return { ...draft, armies: meetings.armies, meetings };
};

/** Step 5 for `d20-graded` (M17-M19, D1-D7, P4, P5). */
export const fightGradedBattles: Phase = (draft) => {
  const front = resolveGradedFront(draft.input.scenario, {
    ...gradedInput(draft),
    armies: draft.armies,
    continuing: draft.meetings.continuing,
    dice: draft.input.dice,
    firstIndex: draft.meetings.battles.length,
    origins: draft.orders.origins
  });
  return { ...draft, armies: front.armies, front };
};

/** Step 7 for `d20-graded` (M27, C2, C3), with its retreats (M21). */
export const fightGradedStanding: Phase = (draft) => {
  const { dice, scenario, start } = draft.input;
  const firstIndex = draft.meetings.battles.length + draft.front.battles.length;
  const foughtIn = new Set(draft.front.battles.map((pending) => pending.site.territoryId));
  const standing = resolveGradedStanding(scenario, gradedInput(draft), draft.armies, dice, firstIndex, foughtIn);
  const departures = settleDepartures(scenario, start, standing.armies, standing.leaving);
  return { ...draft, armies: departures.armies, settled: [...draft.settled, ...departures.settled], standing: standing.battles };
};
