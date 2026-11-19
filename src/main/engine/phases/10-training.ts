import type { Phase } from "./draft";

/**
 * Step 10 (R4, R7, $5, C8): training, replenishment arrivals and build queues advance; new units
 * appear. TODO(m3r1-recruit-replenish) and TODO(m3r1-economy-builds). Until then it passes the
 * draft through unchanged.
 */
export const advanceQueues: Phase = (draft) => draft;
