import type { RuleModule } from "../modules";
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
