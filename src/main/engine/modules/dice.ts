import type { RuleModule } from "../modules";
import { fightMeetings } from "../phases/04-meetings";
import { fightBattles } from "../phases/05-battles";
import { fightStandingBattles } from "../phases/07-standing";
import { updateMorale } from "../phases/09-morale";

/** Today's d6 rules (M12-M24, M27): the preset's parts of steps 4, 5, 7 and 9. */
const d6Steps = { battles: fightBattles, meetings: fightMeetings, morale: updateMorale, standing: fightStandingBattles };

/**
 * The dice area's modules (D1-D8, C2-C7). TODO(m3r1-d20-combat): give `d20-graded` its own
 * parts here: the graded meetings, battles and standing battles, and a morale part with fatigue
 * (C6). Weather's "no digging in" (T4) must be read inside that morale part from
 * `systems.weather`, because parts run in area order and weather's own parts run after dice's.
 */
export const diceModules: readonly RuleModule[] = [
  { area: "dice", blocks: [], id: "d6-table", steps: d6Steps },
  { area: "dice", blocks: ["d20"], id: "d20-graded", steps: d6Steps }
];
