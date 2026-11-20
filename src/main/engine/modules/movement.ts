import type { RuleModule } from "../modules";
import { movementHooks } from "../movement/hooks";
import { checkArmies, type MovementScratch, moveAlongRoutes } from "../movement/transit";
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
 * rail departures, port landings, amphibious lanes), then moves them along their routes at
 * step 3 (transit legs, interception stops, reinforcements, frostbite).
 * TODO(m3r1-sub-territories): Withdraw legs at step 6 use `movement/withdraw.ts` once Withdraw validates.
 */
export const movementModules: readonly RuleModule[] = [
  { area: "movement", blocks: [], id: "single-step", steps: singleStepSteps },
  { area: "movement", blocks: ["subTerritories", "movement"], hooks: movementHooks, id: "allowance", steps: { reveal: checkArmies, transit: moveAlongRoutes } }
];
