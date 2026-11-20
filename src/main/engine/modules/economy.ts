import { buildingCombatModifiers, buildingReplenishBonus } from "../economy/effects";
import { advanceBuildQueues, collectIncome, payForBuilds } from "../economy/queues";
import type { RuleModule } from "../modules";

/**
 * The economy area's modules ($1-$8). `development` pays for Build orders at step 1, hands
 * queues over, damages rail and advances the queues at step 10, and pays income at step 11
 * (`engine/economy/`). Its hooks give buildings their effects in other areas' rules.
 */
export const economyModules: readonly RuleModule[] = [
  { area: "economy", blocks: [], id: "none", steps: {} },
  {
    area: "economy",
    blocks: ["subTerritories", "resources", "development", "buildings", "improvements"],
    hooks: { combatModifiers: buildingCombatModifiers, replenishBonus: buildingReplenishBonus },
    id: "development",
    steps: { income: collectIncome, reveal: payForBuilds, training: advanceBuildQueues }
  }
];
