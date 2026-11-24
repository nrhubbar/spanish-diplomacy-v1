import { type PlannedAir, plannedAir } from "../air/groundSupport";
import { unitKindIn } from "../air/pieces";
import type { BattleContext } from "../combat/odds";
import { requireUnitState } from "../lookup";
import type { MoveRoute } from "../movement/routes";
import type { BattleSide, CombatModifier, FactionId, GameState, GradeId, Scenario, TerritoryId, UnitId } from "../types";
import { cannotAttackAlone } from "./front";
import { battleModifiers, fightingSide } from "./modifiers";
import { type BattleOdds, battleOdds } from "./odds";

/** C15 on the d20: what an attack into a defended territory would meet. */
export type BattleEstimate = BattleOdds & {
  /**
   * R11: the planned Ground Support and what the air battle may leave of it. The chances above
   * are then weighed over the air battle's results; `modifiers` and `rollModifier` leave the
   * support out when an air battle decides it (`air.results`).
   */
  readonly air?: PlannedAir;
  readonly attacker: BattleSide;
  /** D5: the attackers are only artillery, so they would turn back without a battle. */
  readonly cannotAttack: boolean;
  readonly defender: BattleSide;
  readonly kind: "battle";
};

/**
 * C15 on the d20: the odds and grade chances if `unitIds` attack `target`, assuming the
 * defenders there stay and nobody else joins. Every modifier the battle would take is counted
 * from the start-of-turn state: works, faction modifiers, barricades, generals, unit bonuses,
 * fatigue and the hooks (weather, amphibious). R11: `support` names the faction's aircraft
 * planned on Ground Support there; their support counts as the air battle against the defenders'
 * AA may leave it. `plannedRoutes` names the way each attacker takes, where it is already
 * chosen, so passes and landings are judged on it; the others' is inferred from where they stand.
 */
export function estimateBattle(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  unitIds: readonly UnitId[],
  target: TerritoryId,
  support: readonly UnitId[] = [],
  plannedRoutes?: ReadonlyMap<UnitId, MoveRoute>
): BattleEstimate {
  // D17 (m3r1-air-generals): aircraft are not ground combatants.
  const fights = (id: UnitId): boolean => unitKindIn(scenario, state.raised, id) !== "air";
  const attackers = unitIds.filter(fights).map((id) => requireUnitState(state, id));
  const present = Object.values(state.units).filter((unit) => unit.territoryId === target && unit.factionId !== factionId && fights(unit.id));
  const attacker = fightingSide(scenario, state, attackers.map((unit) => ({ from: unit.territoryId, unit })), "attack");
  const defender = fightingSide(scenario, state, present.map((unit) => ({ from: target, unit })), "defence");
  const defenderFactionIds = [...new Set(present.map((unit) => unit.factionId))];
  const modifiers = battleModifiers(scenario, state, state.weather, {
    attackerFactionId: factionId,
    defenderFactionIds,
    diggingIn: true,
    ...(plannedRoutes === undefined ? {} : { plannedRoutes }),
    territoryId: target
  }, { role: "attack", side: attacker, units: attackers }, { role: "defence", side: defender, units: present });
  const rules = scenario.d20;
  const plain = battleOdds(rules, attacker.value, defender.value, modifiers);
  const air = plannedAir(scenario, state, { attackerFactionId: factionId, defenderFactionIds, defenderUnitIds: present.map((unit) => unit.id), territoryId: target }, support);
  const supported = (extra: CombatModifier): BattleOdds => battleOdds(rules, attacker.value, defender.value, [...modifiers, extra]);
  const odds = air === undefined ? plain : air.results === undefined ? supported(air.modifier) : weighOdds(plain, air.results.map(({ chance, roll }) => ({ chance, odds: supported({ ...air.modifier, roll }) })));
  return {
    ...odds,
    ...(air === undefined ? {} : { air }),
    attacker,
    cannotAttack: cannotAttackAlone(scenario, state, attackers),
    defender,
    kind: "battle"
  };
}

/**
 * The d20 odds for bare side values, for the computer player's quick threat checks: only the
 * situational modifiers (works, faction modifiers, barricades, hooks) count, since no units are named.
 */
export function oddsForValues(scenario: Scenario, state: GameState, context: BattleContext, attack: number, defence: number): BattleOdds {
  const empty = { armies: [], value: 0 };
  const modifiers = battleModifiers(scenario, state, state.weather, context, { role: "attack", side: empty, units: [] }, { role: "defence", side: empty, units: [] });
  return battleOdds(scenario.d20, attack, defence, modifiers);
}

/** One way the air battle may end: its chance, and the battle's odds then. */
interface WeighedOdds {
  readonly chance: number;
  readonly odds: BattleOdds;
}

/**
 * R11: the odds over the air battle's results. The chances of each grade, the ground and the
 * expected losses are weighed; the rest is `plain`'s, the battle without Ground Support.
 */
function weighOdds(plain: BattleOdds, results: readonly WeighedOdds[]): BattleOdds {
  const possible = results.filter((result) => result.chance > 0);
  const mix = (value: (odds: BattleOdds) => number): number => possible.reduce((sum, { chance, odds }) => sum + chance * value(odds), 0);
  const chances = new Map<GradeId, number>();
  for (const { chance, odds } of possible) {
    for (const [id, value] of odds.chances) chances.set(id, (chances.get(id) ?? 0) + value * chance);
  }
  const expected = {
    attackerDemoralized: mix((odds) => odds.expected.attackerDemoralized),
    attackerLoss: mix((odds) => odds.expected.attackerLoss),
    defenderDemoralized: mix((odds) => odds.expected.defenderDemoralized),
    defenderLoss: mix((odds) => odds.expected.defenderLoss)
  };
  return { ...plain, chances, expected, gainChance: mix((odds) => odds.gainChance), takeChance: mix((odds) => odds.takeChance) };
}
