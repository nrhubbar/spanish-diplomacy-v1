import { evaluateVictory, victoryProgress } from "../victory";
import { draftState, type Phase } from "./draft";

/**
 * Step 12 (M10): victory, checked last. TODO(m3r1-sub-territories): P7, a partitioned territory
 * counts only when one faction holds all of it (in `victory.ts`).
 */
export const checkVictory: Phase = (draft) => {
  const { scenario } = draft.input;
  const progress = victoryProgress(scenario, draftState(draft));
  const result = evaluateVictory(progress, scenario.victory.tieBreak);
  return { ...draft, victory: { progress, ...(result === undefined ? {} : { result }) } };
};
