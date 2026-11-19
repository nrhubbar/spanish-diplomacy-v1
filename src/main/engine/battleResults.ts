import { requireArmy, unitOrder } from "./board";
import { requireUnitDefinition, requireUnitType } from "./lookup";
import type {
  ArmyLoss,
  BattleArmy,
  BattleResult,
  BattleSide,
  CombatRole,
  GameState,
  Morale,
  Scenario,
  UnitId,
  UnitState
} from "./types";

/**
 * M16 (C2a): what each battle result does to each side's armies. Attrition removes men for
 * good, from the strongest armies first; demoralization halves values for a while, and falls on
 * the weakest armies first. Where the armies go afterwards (claiming, returning, retreating) is
 * decided by the battle's site.
 */

export type SideEffect = "none" | "attrition" | "demoralized" | "destroyed";

export const resultEffects: Readonly<Record<BattleResult, { readonly attacker: SideEffect; readonly defender: SideEffect }>> = {
  "attacker-attrition": { attacker: "attrition", defender: "none" },
  "attacker-demoralized": { attacker: "demoralized", defender: "none" },
  "attacker-eliminated": { attacker: "destroyed", defender: "none" },
  "both-demoralized": { attacker: "demoralized", defender: "demoralized" },
  "defender-demoralized": { attacker: "none", defender: "demoralized" },
  "defender-eliminated": { attacker: "none", defender: "destroyed" },
  "defender-exchange": { attacker: "attrition", defender: "destroyed" }
};

/** What one side suffered. */
export interface Casualties {
  readonly demoralized: readonly UnitId[];
  readonly losses: readonly ArmyLoss[];
  /** The side's armies after the effect; destroyed armies are absent. */
  readonly survivors: readonly UnitState[];
}

/** Demoralized with its recovery clock restarted (M23). */
export const freshlyDemoralized: Morale = { demoralized: true, quietTurns: 0 };

/**
 * Applies one side's effect. `side` is the side as it fought, `armies` the current states of its
 * armies, `role` the values it fought with, and `opposingValue` the other side's value (M12),
 * which is the attrition debt.
 */
export function applySideEffect(
  scenario: Scenario,
  effect: SideEffect,
  side: BattleSide,
  role: CombatRole,
  armies: GameState["units"],
  opposingValue: number
): Casualties {
  const members = side.armies.map((army): Member => ({ army, unit: requireArmy(armies, army.unitId) }));
  const units = members.map((member) => member.unit);
  switch (effect) {
    case "none":
      return { demoralized: [], losses: [], survivors: units };
    case "destroyed":
      return { demoralized: [], losses: units.map((unit) => ({ destroyed: true, men: unit.strength, unitId: unit.id })), survivors: [] };
    case "attrition":
      return attrition(scenario, members, role, opposingValue);
    case "demoralized":
      return demoralize(scenario, side.value, members);
  }
}

/**
 * M16 attrition: the side pays points worth `debt`, strongest army first (highest value; ties:
 * more men, then scenario order). One point costs `fullStrength / base` men, where `base` is the
 * type value the army fought with. An army pays at most the points it holds; one left holding
 * under one point is destroyed and the rest of the debt passes on. Debt beyond the side is dropped.
 */
function attrition(scenario: Scenario, members: readonly Member[], role: CombatRole, debt: number): Casualties {
  const units = members.map((member) => member.unit);
  const ranked = rank(scenario, members, (left, right) => right.army.value - left.army.value || right.unit.strength - left.unit.strength);
  const losses: ArmyLoss[] = [];
  const survivors = new Map(units.map((unit) => [unit.id, unit]));
  let remaining = debt;
  for (const { unit } of ranked) {
    if (remaining <= 0) {
      break;
    }
    const definition = requireUnitDefinition(scenario, unit.id);
    const type = requireUnitType(scenario, definition.type);
    const base = role === "attack" ? type.attack : type.defence;
    const pointMen = definition.fullStrength / base;
    const held = unit.strength / pointMen;
    const paid = Math.min(remaining, held);
    remaining -= paid;
    const men = Math.min(unit.strength, Math.round(paid * pointMen));
    const left = unit.strength - men;
    if (left / pointMen < 1) {
      losses.push({ destroyed: true, men: unit.strength, unitId: unit.id });
      survivors.delete(unit.id);
    } else if (men > 0) {
      losses.push({ destroyed: false, men, unitId: unit.id });
      survivors.set(unit.id, { ...unit, strength: left });
    }
  }
  return { demoralized: [], losses, survivors: units.flatMap((unit) => survivors.get(unit.id) ?? []) };
}

/**
 * M16 demoralization: armies are demoralized from the weakest up (lowest value; ties: fewer men,
 * then scenario order) until the demoralized armies carry at least half of the side's value. An
 * army that is already demoralized restarts its clock (M23).
 */
function demoralize(scenario: Scenario, sideValue: number, members: readonly Member[]): Casualties {
  const ranked = rank(scenario, members, (left, right) => left.army.value - right.army.value || left.unit.strength - right.unit.strength);
  const demoralized = new Set<UnitId>();
  let carried = 0;
  for (const { army } of ranked) {
    if (carried * 2 >= sideValue) {
      break;
    }
    demoralized.add(army.unitId);
    carried += army.value;
  }
  return {
    demoralized: ranked.flatMap(({ army }) => (demoralized.has(army.unitId) ? [army.unitId] : [])),
    losses: [],
    survivors: members.map(({ unit }) => (demoralized.has(unit.id) ? { ...unit, morale: freshlyDemoralized } : unit))
  };
}

/** An army as it fought, with its current state. */
interface Member {
  readonly army: BattleArmy;
  readonly unit: UnitState;
}

/** Orders members by `compare`, then by scenario order. */
function rank(scenario: Scenario, members: readonly Member[], compare: (left: Member, right: Member) => number): readonly Member[] {
  const order = unitOrder(scenario);
  return [...members].sort((left, right) => compare(left, right) || order(left.unit.id) - order(right.unit.id));
}
