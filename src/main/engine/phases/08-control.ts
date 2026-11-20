import { deriveControl } from "../control";
import type { Phase } from "./draft";

/** Step 8 (M6, M7): territory and city control. The partition presets' part. */
export const updateControl: Phase = (draft) => ({
  ...draft,
  control: deriveControl(draft.input.scenario, draft.input.start, draft.armies)
});
