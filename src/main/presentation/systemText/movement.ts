import type { MovementTurnOutcome } from "../../engine/types";

/** Report lines for the movement outcomes (M1-M5). */
export const movementLines: Readonly<Record<MovementTurnOutcome["kind"], string>> = {
  "move-held-back": "An army's move could not go this turn and it stayed put.",
  "move-intercepted": "An army stopped on its way to defend a territory an enemy entered.",
  "move-transit": "An army travelled by rail, by sea or on a march."
};
