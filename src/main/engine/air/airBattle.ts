import type { AirBattleInput, AirBattleResult, AirBattleRolls, AirBattleSide, GroundSupportApplied } from "../types";

/**
 * R11: the air battle fought before a battle when both sides have aircraft over it (Ground
 * Support or Patrol), or the attacker's Ground Support faces the defender's AA. Each side rolls
 * d20 plus each of its aircraft's air roll (the `air-battle` effect: 2 a fighter, 1 a bomber in
 * Spain), and the defender adds its AA; the higher total wins the air and only its Ground Support
 * applies; a tie means neither side's does. Nobody loses aircraft, and recon takes no part. The
 * rolls come from the `air-battle` stream. Pure and roll-free: the caller rolls.
 */
export type { AirBattleAircraft, AirBattleInput, AirBattleResult, AirBattleRolls, AirBattleSide, GroundSupportApplied } from "../types";

/** The chances, 0 to 1 and summing to 1, of each air battle result. */
export interface AirBattleOdds {
  readonly attackerWins: number;
  readonly defenderWins: number;
  readonly tie: number;
}

/** A side's total for a die: the die, its aircraft's air rolls and its AA. */
function sideTotal(side: AirBattleSide, die: number): number {
  return side.aircraft.reduce((sum, aircraft) => sum + aircraft.airRoll, die + side.antiAir);
}

/** R11: the air battle's totals and who won the air. */
export function airBattle(input: AirBattleInput, rolls: AirBattleRolls): AirBattleResult {
  const attackerTotal = sideTotal(input.attacker, rolls.attacker);
  const defenderTotal = sideTotal(input.defender, rolls.defender);
  const winner = attackerTotal > defenderTotal ? "attacker" : defenderTotal > attackerTotal ? "defender" : "tie";
  return { attackerTotal, defenderTotal, rolls, winner };
}

/** The odds of `airBattle` over every pair of d20 rolls, so the estimate always matches the rule. */
export function airBattleOdds(input: AirBattleInput): AirBattleOdds {
  const counts = { attacker: 0, defender: 0, tie: 0 };
  for (let attacker = 1; attacker <= 20; attacker += 1) {
    for (let defender = 1; defender <= 20; defender += 1) counts[airBattle(input, { attacker, defender }).winner] += 1;
  }
  return { attackerWins: counts.attacker / 400, defenderWins: counts.defender / 400, tie: counts.tie / 400 };
}

/** A side's aircraft on Ground Support. */
function supporting(side: AirBattleSide): AirBattleSide["aircraft"] {
  return side.aircraft.filter((aircraft) => aircraft.mission === "support");
}

/**
 * R11: whether an air battle is fought: both sides have aircraft over the battle, or the
 * attacker's Ground Support faces the defender's AA. Otherwise any Ground Support applies unopposed.
 */
export function airBattleFought(input: AirBattleInput): boolean {
  const attacking = input.attacker.aircraft.length > 0;
  return (attacking && input.defender.aircraft.length > 0) || (supporting(input.attacker).length > 0 && input.defender.antiAir > 0);
}

/**
 * R10, R11: the Ground Support a side adds when it applies: its aircraft on Ground Support, best
 * first (then in id order), at most `supportMax` of them, each adding its `battle-support` roll.
 */
function sideSupport(side: AirBattleSide, supportMax: number | undefined, applies: boolean): GroundSupportApplied["attacker"] {
  if (!applies) return { roll: 0, unitIds: [] };
  const best = [...supporting(side)]
    .filter((aircraft) => aircraft.supportRoll > 0)
    .sort((a, b) => b.supportRoll - a.supportRoll || (a.unitId < b.unitId ? -1 : a.unitId > b.unitId ? 1 : 0))
    .slice(0, supportMax ?? Number.POSITIVE_INFINITY);
  return { roll: best.reduce((sum, aircraft) => sum + aircraft.supportRoll, 0), unitIds: best.map((aircraft) => aircraft.unitId) };
}

/**
 * R11: the Ground Support each side gets, given who won the air: only the winner's, none on a tie,
 * and, with no air battle (`undefined`), every side's that flew.
 */
export function groundSupport(input: AirBattleInput, winner: AirBattleResult["winner"] | undefined): GroundSupportApplied {
  return {
    attacker: sideSupport(input.attacker, input.supportMax, winner === undefined || winner === "attacker"),
    defender: sideSupport(input.defender, input.supportMax, winner === undefined || winner === "defender")
  };
}
