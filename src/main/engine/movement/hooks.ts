import type { CombatHookContext, RuleHooks } from "../hooks";
import type { CombatModifier } from "../types";
import { truckAllowanceDelta } from "./allowance";
import { connectionBetween, friendlyPort } from "./network";

/**
 * M5, D7: an amphibious assault takes the d20 block's `amphibious` modifier. The hook sees only
 * the start-of-turn state and the attackers, so it reads the assault from where they stood: an
 * attacker whose territory reaches the battle only by sea, while its faction holds no port
 * there, came ashore. A sea leg is always a move's only leg (`routes.ts`), so this is exact.
 * Under the d6 rules the modifier is left out (the d20 value would swamp a d6).
 */
export function amphibiousModifiers(context: CombatHookContext): readonly CombatModifier[] {
  const { scenario, state, territoryId } = context;
  const roll = scenario.d20?.modifiers.amphibious;
  if (scenario.rules.dice !== "d20-graded" || roll === undefined || roll === 0) return [];
  const amphibious = (context.attackerUnitIds ?? []).some((unitId) => {
    const from = state.units[unitId]?.territoryId;
    return from !== undefined
      && from !== territoryId
      && connectionBetween(scenario, from, territoryId, "land") === undefined
      && connectionBetween(scenario, from, territoryId, "sea") !== undefined
      && friendlyPort(scenario, state, context.attackerFactionId, territoryId) === undefined;
  });
  return amphibious ? [{ kind: "amphibious", roll }] : [];
}

/** The `allowance` module's answers to the cross-area questions: trucks (M1) and amphibious assaults (M5). */
export const movementHooks: RuleHooks = {
  allowanceDelta: truckAllowanceDelta,
  combatModifiers: amphibiousModifiers
};
