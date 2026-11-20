import type { RuleModule } from "../modules";
import { partitionCanDigIn, partitionOrderVerdict, partitionRetreatAllowed } from "../partition/orders";
import { provincesControl, provincesOccupation, provincesStanding } from "../partition/steps";
import { settleOccupation } from "../phases/06-occupation";
import { updateControl } from "../phases/08-control";

/** Today's territory control (M6, M7, M18, M21): the preset's parts of steps 6 and 8. */
const partitionSteps = { control: updateControl, occupation: settleOccupation };

/**
 * The partition area's modules (P1-P8, C1). `provinces` derives territory control from the
 * sub-territories' holders (`partition/`): battle ground, occupation, the path rule and
 * withdrawals in step 6, standing-battle ground in step 7, and in step 8 the one-a-turn sweep,
 * rail damage and control. Its hooks refuse moves out of contested ground and accept Withdraw
 * (C1), require a path for retreats (P6), and stop works growing in contested ground.
 */
export const partitionModules: readonly RuleModule[] = [
  { area: "partition", blocks: [], id: "none", steps: partitionSteps },
  {
    area: "partition",
    blocks: ["subTerritories"],
    hooks: {
      canDigIn: ({ scenario, state, territoryId }) => partitionCanDigIn(scenario, state, territoryId),
      orderVerdict: partitionOrderVerdict,
      retreatAllowed: partitionRetreatAllowed
    },
    id: "provinces",
    steps: { control: provincesControl, occupation: provincesOccupation, standing: provincesStanding }
  }
];
