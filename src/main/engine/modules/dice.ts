import { updateGradedMorale } from "../d20/morale";
import { fightGradedBattles, fightGradedMeetings, fightGradedStanding } from "../d20/phases";
import type { RuleModule } from "../modules";
import { fightMeetings } from "../phases/04-meetings";
import { fightBattles } from "../phases/05-battles";
import { fightStandingBattles } from "../phases/07-standing";
import { updateMorale } from "../phases/09-morale";

/** Today's d6 rules (M12-M24, M27): the preset's parts of steps 4, 5, 7 and 9. */
const d6Steps = { battles: fightBattles, meetings: fightMeetings, morale: updateMorale, standing: fightStandingBattles };

/**
 * The d20's parts (D1-D8, C2-C7, U6, `engine/d20/`): graded meetings, battles and standing
 * battles, and a morale part with fatigue, rest and digging in at the d20's rates. Weather's "no
 * digging in" (T4) reaches the morale part through the `canDigIn` hook.
 */
const d20Steps = { battles: fightGradedBattles, meetings: fightGradedMeetings, morale: updateGradedMorale, standing: fightGradedStanding };

/** The dice area's modules (D1-D8, C2-C7). */
export const diceModules: readonly RuleModule[] = [
  { area: "dice", blocks: [], id: "d6-table", steps: d6Steps },
  { area: "dice", blocks: ["d20"], id: "d20-graded", steps: d20Steps }
];
