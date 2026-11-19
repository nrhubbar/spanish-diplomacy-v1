import type { RuleModule } from "../modules";
import type { Phase } from "../phases/draft";

/** TODO(m3r1-economy-builds): pay for Build orders at reveal, and refund what fails ($5). */
const payForBuilds: Phase = (draft) => draft;
/** TODO(m3r1-economy-builds): advance each sub-territory's build queue ($5). */
const advanceBuildQueues: Phase = (draft) => draft;
/** TODO(m3r1-economy-builds): income from whole territories ($2); raid cuts are the air module's. */
const collectIncome: Phase = (draft) => draft;

/** The economy area's modules ($1-$8). Pass-through parts until the slice lands. */
export const economyModules: readonly RuleModule[] = [
  { area: "economy", blocks: [], id: "none", steps: {} },
  {
    area: "economy",
    blocks: ["subTerritories", "resources", "development", "buildings", "improvements"],
    id: "development",
    steps: { income: collectIncome, reveal: payForBuilds, training: advanceBuildQueues }
  }
];
