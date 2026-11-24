import type { RuleModule } from "../modules";
import { movementHooks } from "../movement/hooks";
import { checkArmies, type MovementScratch, moveAlongRoutes } from "../movement/transit";
import { validateAllowanceMove, validateSingleStepMove } from "../movement/validation";
import { moveInTransit } from "../phases/03-transit";

declare module "../phases/draft" {
  interface TurnScratch {
    /** The movement area's turn-only data: each moving unit's route and submitted order (M1-M5). */
    readonly movement?: MovementScratch;
  }
}

/** Today's single steps (M2, M11): the preset's part of step 3. */
const singleStepSteps = { transit: moveInTransit };

/**
 * The movement area's modules (M1-M6). `allowance` checks moves as armies at reveal (allowance,
 * train places, port landings, amphibious lanes), then moves them along their routes at
 * step 3 (transit legs, interception stops, reinforcements).
 * Both validate Move orders (`movement/validation.ts`): one step under `single-step`, a route
 * under `allowance`.
 */
export const movementModules: readonly RuleModule[] = [
  { area: "movement", blocks: [], hooks: { validateOrder: { move: validateSingleStepMove } }, id: "single-step", steps: singleStepSteps },
  {
    area: "movement",
    blocks: ["subTerritories", "movement"],
    hooks: { ...movementHooks, validateOrder: { move: validateAllowanceMove } },
    id: "allowance",
    steps: { reveal: checkArmies, transit: moveAlongRoutes }
  }
];
