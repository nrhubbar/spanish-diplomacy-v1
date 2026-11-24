import { settleDepartures } from "../retreat";
import type { Phase, TurnDraft } from "../phases/draft";
import type { BattleInput } from "./battle";
import { resolveFront } from "./front";
import { resolveMeetings } from "./meeting";
import { resolveStanding } from "./standing";

/** The turn's weather as the battles read it: this turn's roll if step 0 made one, else the start's (CT-44). */
function battleInput(draft: TurnDraft): BattleInput {
  return { scratch: draft.scratch, start: draft.input.start, weather: draft.systems.weather ?? draft.input.start.weather };
}

/** Step 4 (M20). */
export const fightMeetings: Phase = (draft) => {
  const meetings = resolveMeetings(draft.input.scenario, battleInput(draft), draft.armies, draft.orders.advances, draft.input.dice);
  return { ...draft, armies: meetings.armies, meetings };
};

/** Step 5 (M17-M19, D1-D7, P4, P5). */
export const fightBattles: Phase = (draft) => {
  const front = resolveFront(draft.input.scenario, {
    ...battleInput(draft),
    armies: draft.armies,
    continuing: draft.meetings.continuing,
    dice: draft.input.dice,
    firstIndex: draft.meetings.battles.length,
    origins: draft.orders.origins
  });
  return { ...draft, armies: front.armies, front };
};

/** Step 7 (M27, C2, C3), with its retreats (M21). */
export const fightStandingBattles: Phase = (draft) => {
  const { dice, scenario, start } = draft.input;
  const firstIndex = draft.meetings.battles.length + draft.front.battles.length;
  const foughtIn = new Set(draft.front.battles.map((pending) => pending.site.territoryId));
  const standing = resolveStanding(scenario, battleInput(draft), draft.armies, dice, firstIndex, foughtIn);
  const departures = settleDepartures(scenario, start, standing.armies, standing.leaving);
  return { ...draft, armies: departures.armies, settled: [...draft.settled, ...departures.settled], standing: standing.battles };
};
