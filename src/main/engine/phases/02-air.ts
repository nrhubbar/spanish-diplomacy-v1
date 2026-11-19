import type { Phase } from "./draft";

/**
 * Step 2 (U2-U4): air missions. The engine has no part of its own here; the selected modules' parts run instead
 * (air). A slice adds its part to its area's file under `engine/modules/`, not here.
 */
export const airStep: Phase = (draft) => draft;
