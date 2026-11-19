import type { RuleModule } from "../modules";
import { settleOccupation } from "../phases/06-occupation";
import { updateControl } from "../phases/08-control";

/** Today's territory control (M6, M7, M18, M21): the preset's parts of steps 6 and 8. */
const partitionSteps = { control: updateControl, occupation: settleOccupation };

/**
 * The partition area's modules (P1-P8, C1). TODO(m3r1-sub-territories): give `provinces` its
 * own parts here: sub-territory flips, the path rule and withdrawals in step 6, standing-battle
 * flips in step 7, and in step 8 sub-territory control, the one-a-turn sweep and rail damage.
 */
export const partitionModules: readonly RuleModule[] = [
  { area: "partition", blocks: [], id: "none", steps: partitionSteps },
  { area: "partition", blocks: ["subTerritories"], id: "provinces", steps: partitionSteps }
];
