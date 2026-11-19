import type { Phase } from "./draft";

/**
 * Step 0 (T2, T3): the weather roll and the forecast. The engine has no part of its own here; the selected modules' parts run instead
 * (weather). A slice adds its part to its area's file under `engine/modules/`, not here.
 */
export const weatherStep: Phase = (draft) => draft;
