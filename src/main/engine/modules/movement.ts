import type { RuleModule } from "../modules";
import type { MoveLeg, UnitId } from "../types";

declare module "../phases/draft" {
  interface TurnScratch {
    /** The movement area's turn-only data. TODO(m3r1-movement-rail-ports): shape it as the slice needs. */
    readonly movement?: {
      /** M4: each moving unit's legs, resolved at step 3. */
      readonly legs: ReadonlyMap<UnitId, readonly MoveLeg[]>;
    };
  }
}
import { moveInTransit } from "../phases/03-transit";

/** Today's single steps (M2, M11): the preset's part of step 3. */
const singleStepSteps = { transit: moveInTransit };

/**
 * The movement area's modules (M1-M6). TODO(m3r1-movement-rail-ports): give `allowance` its own
 * transit part here (rail, sea and truck legs, interception stops, frostbite) and the path use
 * of withdrawals (P6).
 */
export const movementModules: readonly RuleModule[] = [
  { area: "movement", blocks: [], id: "single-step", steps: singleStepSteps },
  { area: "movement", blocks: ["subTerritories", "movement"], id: "allowance", steps: singleStepSteps }
];
