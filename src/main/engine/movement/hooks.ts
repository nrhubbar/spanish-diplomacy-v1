import type { CombatHookContext, RuleHooks } from "../hooks";
import { hasLinks, linkBetween, passName, territoryOfSub } from "../network/links";
import { allFoot, marchCrossing, startSubTerritories } from "../network/paths";
import type { CombatModifier, TerritoryId, UnitId } from "../types";
import { truckAllowanceDelta } from "./allowance";
import { connectionBetween, landingAt, unitTypeOf } from "./network";

/**
 * M5, D7: an amphibious assault takes the d20 block's `amphibious` modifier. While a turn
 * resolves, the hook reads each attacker's route from the movement scratch: an attacker whose
 * route is a sea leg into the battle territory that lands as an assault came ashore. For a
 * planning estimate (no scratch) it infers the same from where the attackers stand: a territory
 * whose army cannot March into the battle (no land connection, or no link from its pocket, R5)
 * but has a sea lane there, while the faction does not hold the lane's port (Q-CITY-7). Under the d6 rules the modifier is left out (the d20 value would swamp a d6).
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
      && !marchesInto(context, unitId, from)
      && connectionBetween(scenario, from, territoryId, "sea") !== undefined
      && landingAt(scenario, state, context.attackerFactionId, from, territoryId).kind === "amphibious";
  });
  return amphibious ? [{ kind: "amphibious", roll }] : [];
}

/** R5: the unit could March from `from` into the battle territory: a land connection, and a link its pocket may cross. */
function marchesInto(context: CombatHookContext, unitId: UnitId, from: TerritoryId): boolean {
  const { scenario, state, territoryId } = context;
  if (connectionBetween(scenario, from, territoryId, "land") === undefined) return false;
  return !hasLinks(scenario) || marchCrossing(scenario, state, startSubTerritories(scenario, state, context.attackerFactionId, from, [unitId]), territoryId, allFoot(scenario, state, [unitId])).ok;
}

/**
 * R6: the pass an attacking unit crossed into the battle territory, or undefined when it came
 * another way (a link that is not a pass, by sea, or it was already there). While a turn
 * resolves, the hook reads the unit's route from the movement scratch: its last link into the
 * territory. For a planning estimate it reads the link a March from where the unit stands
 * would cross (`marchCrossing`, which takes a pass last).
 */
function passCrossed(context: CombatHookContext, unitId: UnitId): string | undefined {
  const { scenario, state, territoryId } = context;
  const routes = context.scratch?.movement?.routes;
  if (routes !== undefined) {
    const route = routes.get(unitId);
    const step = route?.to === territoryId ? route.path.findLast((each) => territoryOfSub(scenario, each.to) === territoryId) : undefined;
    if (step === undefined || step.mode === "sea" || territoryOfSub(scenario, step.from) === territoryId) return undefined;
    const link = linkBetween(scenario, step.from, step.to);
    return link === undefined ? undefined : passName(link);
  }
  const from = state.units[unitId]?.territoryId;
  if (from === undefined || from === territoryId || connectionBetween(scenario, from, territoryId, "land") === undefined) return undefined;
  const crossing = marchCrossing(scenario, state, startSubTerritories(scenario, state, context.attackerFactionId, from, [unitId]), territoryId, allFoot(scenario, state, [unitId]));
  return crossing.ok ? passName(crossing.link) : undefined;
}

/**
 * R6: an attack over a mountain pass. When every attacking ground unit crossed a pass into the
 * territory, the attacker's roll takes the scenario's pass `defenderRoll`; it stacks with dug-in.
 * With `lostToFlanking`, one attacking ground unit over any other link (or by sea, or already in
 * the territory) cancels it. The d20 rules only, like the amphibious modifier.
 */
export function passModifiers(context: CombatHookContext): readonly CombatModifier[] {
  const { scenario, state } = context;
  const rules = scenario.linkModifiers.pass;
  if (scenario.rules.dice !== "d20-graded" || rules === undefined || rules.defenderRoll === 0 || !hasLinks(scenario)) return [];
  const ground = (context.attackerUnitIds ?? []).filter((unitId) => (unitTypeOf(scenario, state, unitId)?.kind ?? "ground") === "ground");
  const passes = ground.map((unitId) => passCrossed(context, unitId));
  const name = passes.find((each) => each !== undefined);
  if (name === undefined || (rules.lostToFlanking && passes.includes(undefined))) return [];
  return [{ kind: "pass", name, roll: rules.defenderRoll }];
}

/** The movement module's combat modifiers: amphibious assaults (M5) and passes (R6). */
export function movementCombatModifiers(context: CombatHookContext): readonly CombatModifier[] {
  return [...amphibiousModifiers(context), ...passModifiers(context)];
}

/** The `allowance` module's answers to the cross-area questions: trucks (M1), amphibious assaults (M5) and passes (R6). */
export const movementHooks: RuleHooks = {
  allowanceDelta: truckAllowanceDelta,
  combatModifiers: movementCombatModifiers
};
