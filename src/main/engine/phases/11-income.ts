import type { Phase } from "./draft";

/**
 * Step 11 ($2, U3): income from whole territories, minus raid cuts. The engine has no part of its own here; the selected modules' parts run instead
 * (economy, then air). A slice adds its part to its area's file under `engine/modules/`, not here.
 */
export const incomeStep: Phase = (draft) => draft;
