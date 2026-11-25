import { compareIds } from "../board";
import { scoreFor } from "../d20/odds";
import { d20Faces } from "../d20/rules";
import { dieFaces } from "../dice";
import type { AirBattleAircraft, AirBattleInput, AirBattleResult, AirBattleRow, AirBattleSide, GroundSupportApplied, UnitId } from "../types";

/**
 * R11: the air battle fought before a battle when both sides have aircraft over it (Ground
 * Support or Patrol), or the attacker's Ground Support faces the defender's AA. One d20 decides it
 * for both: the die, plus the air roll of each of the attacker's aircraft (the `air-battle`
 * effect: 2 a fighter, 1 a bomber in Spain), less the defender's aircraft and AA, kept within 0 to
 * 20, read on the scenario's `air.battleTable`. The row gives Ground Support to one side, or to
 * nobody, and says how many aircraft each side loses. Recon takes no part. The die comes from the
 * `air-battle` stream. Pure and roll-free: the caller rolls.
 */
export type { AirBattleAircraft, AirBattleInput, AirBattleResult, AirBattleRow, AirBattleSide, GroundSupportApplied } from "../types";

/** One row of the air battle table and its chance, 0 to 1; the rows' chances sum to 1. */
export interface AirBattleChance {
  readonly chance: number;
  readonly row: AirBattleRow;
}

/** What a side counts with in the air battle: its aircraft's air rolls and its AA. */
function sideStrength(side: AirBattleSide): number {
  return side.aircraft.reduce((sum, aircraft) => sum + aircraft.airRoll, side.antiAir);
}

/** R11: the air battle for a die: the score of both sides together, and the table's row. */
export function airBattle(table: readonly AirBattleRow[], input: AirBattleInput, die: number): AirBattleResult {
  const modifier = sideStrength(input.attacker) - sideStrength(input.defender);
  const score = scoreFor(die, modifier);
  const row = table.find((candidate) => score <= candidate.upTo);
  if (row === undefined) throw new Error(`Invariant violated: no air battle row for score ${String(score)}.`);
  return { die, modifier, row, score };
}

/** The chance of every row of the table over the d20's faces, so the estimate always matches the rule. */
export function airBattleOdds(table: readonly AirBattleRow[], input: AirBattleInput): readonly AirBattleChance[] {
  const rows = d20Faces.map((die) => airBattle(table, input, die).row);
  return table.map((row) => ({ chance: rows.filter((hit) => hit === row).length / dieFaces, row }));
}

/**
 * R11: whether an air battle is fought: both sides have aircraft over the battle, or the
 * attacker's Ground Support faces the defender's AA. Otherwise any Ground Support applies unopposed.
 */
export function airBattleFought(input: AirBattleInput): boolean {
  const attacking = input.attacker.aircraft.length > 0;
  const supporting = input.attacker.aircraft.some((aircraft) => aircraft.mission === "support");
  return (attacking && input.defender.aircraft.length > 0) || (supporting && input.defender.antiAir > 0);
}

/** The aircraft a side loses: the weakest in the air first, then the greatest Ground Support, then in id order. */
function sideLost(side: AirBattleSide, count: number): readonly UnitId[] {
  return [...side.aircraft]
    .sort((a, b) => a.airRoll - b.airRoll || b.supportRoll - a.supportRoll || compareIds(a.unitId, b.unitId))
    .slice(0, count)
    .map((aircraft) => aircraft.unitId);
}

/** R11: the aircraft an air battle's row shoots down, the attacker's first. */
export function aircraftLost(input: AirBattleInput, row: AirBattleRow): readonly UnitId[] {
  return [...sideLost(input.attacker, row.aircraftLost.attacker), ...sideLost(input.defender, row.aircraftLost.defender)];
}

/**
 * R10, R11: the Ground Support a side adds: its aircraft on Ground Support, best first (then in id
 * order), at most `supportMax` of them, each adding its `battle-support` roll.
 */
function sideSupport(aircraft: readonly AirBattleAircraft[], supportMax: number | undefined): GroundSupportApplied["attacker"] {
  const best = aircraft
    .filter((entry) => entry.mission === "support" && entry.supportRoll > 0)
    .sort((a, b) => b.supportRoll - a.supportRoll || compareIds(a.unitId, b.unitId))
    .slice(0, supportMax ?? Number.POSITIVE_INFINITY);
  return { roll: best.reduce((sum, entry) => sum + entry.supportRoll, 0), unitIds: best.map((entry) => entry.unitId) };
}

/**
 * R11: the Ground Support each side gets. After an air battle (`row`), only the side its row names
 * gets any, from the aircraft it still has; with no air battle (`undefined`), both sides do.
 */
export function groundSupport(input: AirBattleInput, row: AirBattleRow | undefined): GroundSupportApplied {
  const lost = row === undefined ? [] : aircraftLost(input, row);
  const counting = (side: "attacker" | "defender"): readonly AirBattleAircraft[] =>
    (row === undefined || row.support === side ? input[side].aircraft.filter((aircraft) => !lost.includes(aircraft.unitId)) : []);
  return { attacker: sideSupport(counting("attacker"), input.supportMax), defender: sideSupport(counting("defender"), input.supportMax) };
}
