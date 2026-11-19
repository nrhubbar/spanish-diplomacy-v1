import type { Phase } from "./draft";

/**
 * Step 10 (R4, R7, $5, C8): training, replenishment arrivals and build queues advance. The engine has no part of its own here; the selected modules' parts run instead
 * (recruitment, economy). A slice adds its part to its area's file under `engine/modules/`, not here.
 */
export const trainingStep: Phase = (draft) => draft;
