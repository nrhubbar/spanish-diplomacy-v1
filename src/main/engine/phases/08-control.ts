import { deriveControl } from "../control";
import type { Phase } from "./draft";

/**
 * Step 8 (M6, M7): territory and city control. TODO(m3r1-sub-territories): sub-territory
 * control, the one-a-turn sweep, and rail damage ($8).
 */
export const updateControl: Phase = (draft) => ({
  ...draft,
  control: deriveControl(draft.input.scenario, draft.input.start, draft.armies)
});
