import type { RuleModule } from "../modules";
import type { Phase } from "../phases/draft";

/** TODO(m3r1-recruit-replenish): pay for Recruit and Replenish orders at reveal, and refund what fails (R2, R5). */
const payForRecruits: Phase = (draft) => draft;
/** TODO(m3r1-recruit-replenish): replenished men arrive, morale clears, battles cancel with a refund (R5). */
const replenish: Phase = (draft) => draft;
/** TODO(m3r1-recruit-replenish): training advances, pauses in contested ground, new units appear (R4, R7, C8). */
const advanceTraining: Phase = (draft) => draft;

/** The recruitment area's modules (R1-R7). Pass-through parts until the slice lands. */
export const recruitmentModules: readonly RuleModule[] = [
  { area: "recruitment", blocks: [], id: "none", steps: {} },
  {
    area: "recruitment",
    blocks: ["subTerritories", "resources", "buildings", "recruitment"],
    id: "buildings",
    steps: { morale: replenish, reveal: payForRecruits, training: advanceTraining }
  }
];
