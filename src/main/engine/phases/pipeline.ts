import { updateMorale } from "../d20/morale";
import { fightBattles, fightMeetings, fightStandingBattles } from "../d20/phases";
import { turnSteps } from "../modules";
import type { Scenario } from "../types";
import { weatherStep } from "./00-weather";
import { revealOrders } from "./01-reveal";
import { airStep } from "./02-air";
import { trainingStep } from "./10-training";
import { incomeStep } from "./11-income";
import { checkVictory } from "./12-victory";
import type { Phase, TurnDraft } from "./draft";

/**
 * The engine's own part of each step: the battles and morale (D1-D8, C2-C7, `engine/d20/`), and
 * steps 0, 2, 10 and 11, whose files are the home of the step's contract. Weather's "no digging
 * in" (T4) reaches the morale part through the `canDigIn` hook.
 */
const core: Partial<Record<(typeof turnSteps)[number], Phase>> = {
  air: airStep,
  battles: fightBattles,
  income: incomeStep,
  meetings: fightMeetings,
  morale: updateMorale,
  reveal: revealOrders,
  standing: fightStandingBattles,
  training: trainingStep,
  victory: checkVictory,
  weather: weatherStep
};

/**
 * Section 2: runs the turn's steps in order. Each step runs the engine's own part first, then
 * each selected module's part in `ruleAreas` order (economy, recruitment, weather,
 * movement, partition, air), each on the draft the previous part returned. A later area's part
 * cannot undo an earlier one's, so a rule that must shape an earlier part (Snow and digging in)
 * is read inside that part.
 */
export function runTurnSteps(scenario: Scenario, start: TurnDraft): TurnDraft {
  let draft = start;
  for (const step of turnSteps) {
    const own = core[step];
    if (own !== undefined) draft = own(draft);
    for (const module of scenario.modules) {
      const part = module.steps[step];
      if (part !== undefined) draft = part(draft);
    }
  }
  return draft;
}
