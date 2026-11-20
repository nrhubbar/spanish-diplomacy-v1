import type { RuleModule } from "../modules";
import { advanceTraining, payForRecruits, replenish } from "../recruitment/phases";

/**
 * The recruitment area's modules (R1-R7, C8). `buildings` pays for Recruit and Replenish orders
 * at reveal (step 1), lands replenished men after battles (step 9, after the dice module's
 * morale part), and advances training (step 10). The rules live in `engine/recruitment/`.
 */
export const recruitmentModules: readonly RuleModule[] = [
  { area: "recruitment", blocks: [], id: "none", steps: {} },
  {
    area: "recruitment",
    blocks: ["subTerritories", "resources", "buildings", "recruitment"],
    id: "buildings",
    steps: { morale: replenish, reveal: payForRecruits, training: advanceTraining }
  }
];
