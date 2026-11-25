import type { Scenario } from "../../engine/types";
import type { OrderOffer } from "../../presentation/orderMenu";
import { enemyPresent, selectedWithdrawRoutes } from "./contested";
import { replenishPlan } from "./recruitment";
import { orderKindsFor, type PlanningSession } from "./selection";

/** U4: the orders the selection bar offers the selected armies, in menu order (O2), with what Replenish and Withdraw would do; none when nothing is selected. */
export function orderOffer(scenario: Scenario, session: PlanningSession): OrderOffer {
  const { selectedTerritoryId: territoryId, selectedUnitIds } = session.draft;
  if (selectedUnitIds.length === 0) return { kinds: [] };
  const kinds = orderKindsFor(session, scenario);
  return {
    kinds,
    ...(kinds.includes("withdraw") && territoryId !== undefined
      ? { contested: { enemyPresent: enemyPresent(session, territoryId), routes: selectedWithdrawRoutes(scenario, session), territoryId } }
      : {}),
    ...(kinds.includes("replenish") ? { replenish: replenishPlan(scenario, session) } : {})
  };
}
