import { type OrderValidationContext, unavailableOrderReason } from "../hooks";
import type { RuleModule } from "../modules";
import type { ValidationResult } from "../types";
import { advanceTraining, payForRecruits, replenish } from "../recruitment/phases";
import { validateRecruitOrder, validateReplenishOrder } from "../recruitment/rules";

/** M9: the rules name the area's module, as the economy and air validators also check. */
function whenSelected(scenario: OrderValidationContext["scenario"]): ValidationResult | undefined {
  return scenario.rules.recruitment === "none" ? { ok: false, reason: unavailableOrderReason } : undefined;
}

/**
 * The recruitment area's modules (R1-R7, C8). `buildings` pays for Recruit and Replenish orders
 * at reveal (step 1), lands replenished men after battles (step 9, after the dice module's
 * morale part), and advances training (step 10). It validates both orders (`validateOrder`).
 * The rules live in `engine/recruitment/`.
 */
export const recruitmentModules: readonly RuleModule[] = [
  { area: "recruitment", blocks: [], id: "none", steps: {} },
  {
    area: "recruitment",
    blocks: ["subTerritories", "resources", "buildings", "recruitment"],
    hooks: {
      validateOrder: {
        recruit: ({ order, scenario, state }) => whenSelected(scenario) ?? validateRecruitOrder(scenario, state, order),
        replenish: ({ order, scenario, state }) => whenSelected(scenario) ?? validateReplenishOrder(scenario, state, order)
      }
    },
    id: "buildings",
    steps: { morale: replenish, reveal: payForRecruits, training: advanceTraining }
  }
];
