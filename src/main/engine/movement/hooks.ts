import type { CombatHookContext, RuleHooks } from "../hooks";
import { hasLinks, linkBetween, passName, territoryOfSub } from "../network/links";
import { allFoot, marchCrossing, startSubTerritories } from "../network/paths";
import type { MoveRoute } from "./routes";
import type { CombatModifier, TerritoryId, UnitId } from "../types";
import { truckAllowanceDelta } from "./allowance";
import { connectionBetween, landingAt, unitTypeOf } from "./network";

/**
 * The way an attacker comes: its route while a turn resolves ("elsewhere" when it has none) or as
 * planned, else "unknown", and a planning estimate infers it from where the unit stands.
 */
function wayOf(context: CombatHookContext, unitId: UnitId): MoveRoute | "elsewhere" | "unknown" {
  const resolved = context.scratch?.movement?.routes;
  if (resolved !== undefined) return resolved.get(unitId) ?? "elsewhere";
  return context.plannedRoutes?.get(unitId) ?? "unknown";
}

/**
 * M5, D7: an amphibious assault takes the d20 block's `amphibious` modifier. While a turn
 * resolves, the hook reads each attacker's route from the movement scratch: an attacker whose
 * route is a sea leg into the battle territory that lands as an assault came ashore. A planning
 * estimate reads the planned routes the same way, and infers the rest from where the attackers stand: a territory
 * whose army cannot March into the battle (no land connection, or no link from its pocket, R5)
 * but has a sea lane there, while the faction does not hold the lane's port (Q-CITY-7).
 */
export function amphibiousModifiers(context: CombatHookContext): readonly CombatModifier[] {
  const { scenario, state, territoryId } = context;
  const roll = scenario.d20.modifiers.amphibious;
  if (roll === 0) return [];
  const amphibious = (context.attackerUnitIds ?? []).some((unitId) => {
    const way = wayOf(context, unitId);
    if (way === "elsewhere") return false;
    if (way !== "unknown") return way.to === territoryId && way.sea?.kind === "amphibious";
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
 * territory. A planning estimate reads the planned route the same way; without one it reads the
 * link a March from where the unit stands would cross (`marchCrossing`, which takes a pass last).
 */
function passCrossed(context: CombatHookContext, unitId: UnitId): string | undefined {
  const { scenario, state, territoryId } = context;
  const way = wayOf(context, unitId);
  if (way === "elsewhere") return undefined;
  if (way !== "unknown") {
    const step = way.to === territoryId ? way.path.findLast((each) => territoryOfSub(scenario, each.to) === territoryId) : undefined;
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
 * the territory) cancels it.
 */
export function passModifiers(context: CombatHookContext): readonly CombatModifier[] {
  const { scenario, state } = context;
  const rules = scenario.linkModifiers.pass;
  if (rules === undefined || rules.defenderRoll === 0 || !hasLinks(scenario)) return [];
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
