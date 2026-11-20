import type { CombatHookContext, RuleHooks } from "../hooks";
import type { CombatModifier } from "../types";
import { truckAllowanceDelta } from "./allowance";
import { connectionBetween, landingAt } from "./network";

/**
 * M5, D7: an amphibious assault takes the d20 block's `amphibious` modifier. While a turn
 * resolves, the hook reads each attacker's route from the movement scratch: an attacker whose
 * route is a sea leg into the battle territory that lands as an assault came ashore. For a
 * planning estimate (no scratch) it infers the same from where the attackers stand: a territory
 * that reaches the battle only by sea, while the faction does not hold the lane's port there
 * (Q-CITY-7). Under the d6 rules the modifier is left out (the d20 value would swamp a d6).
 */
export function amphibiousModifiers(context: CombatHookContext): readonly CombatModifier[] {
  const { scenario, state, territoryId } = context;
  const roll = scenario.d20?.modifiers.amphibious;
  if (scenario.rules.dice !== "d20-graded" || roll === undefined || roll === 0) return [];
  const routes = context.scratch?.movement?.routes;
  const amphibious = (context.attackerUnitIds ?? []).some((unitId) => {
    const route = routes?.get(unitId);
    if (route !== undefined) return route.to === territoryId && route.sea?.kind === "amphibious";
    if (routes !== undefined) return false;
    const from = state.units[unitId]?.territoryId;
    return from !== undefined
      && from !== territoryId
      && connectionBetween(scenario, from, territoryId, "land") === undefined
      && connectionBetween(scenario, from, territoryId, "sea") !== undefined
      && landingAt(scenario, state, context.attackerFactionId, from, territoryId).kind === "amphibious";
  });
  return amphibious ? [{ kind: "amphibious", roll }] : [];
}

/** The `allowance` module's answers to the cross-area questions: trucks (M1) and amphibious assaults (M5). */
export const movementHooks: RuleHooks = {
  allowanceDelta: truckAllowanceDelta,
  combatModifiers: amphibiousModifiers
};
