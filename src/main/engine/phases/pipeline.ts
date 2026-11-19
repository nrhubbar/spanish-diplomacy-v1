import { turnSteps } from "../modules";
import type { Scenario } from "../types";
import { revealOrders } from "./01-reveal";
import { checkVictory } from "./12-victory";
import type { Phase, TurnDraft } from "./draft";

/** The engine's own steps; every other step is made of the selected modules' parts. */
const core: Partial<Record<(typeof turnSteps)[number], Phase>> = { reveal: revealOrders, victory: checkVictory };

/**
 * Section 2: runs the turn's steps in order. Each step runs the engine's own part (reveal,
 * victory) first, then each selected module's part in `ruleAreas` order.
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
