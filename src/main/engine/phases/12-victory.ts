import { evaluateVictory, victoryProgress } from "../victory";
import { draftState, type Phase } from "./draft";

/** Step 12 (M10): victory, checked last. TODO(m3r1-sub-territories): P7 partitioned territories. */
export const checkVictory: Phase = (draft) => {
  const { scenario } = draft.input;
  const progress = victoryProgress(scenario, draftState(draft));
  const result = evaluateVictory(progress, scenario.victory.tieBreak);
  return { ...draft, victory: { progress, ...(result === undefined ? {} : { result }) } };
};
