import type { AirBattleOutcome, AirBattleSide, BattleOutcome, FactionId, Scenario, TurnOutcome } from "../engine/types";
import { glyphs } from "./glyphs";
import { factionName, territoryName, unitName } from "./text";

/**
 * U10, R11: the air battle on a battle card, in words: both sides' aircraft and AA, both rolls,
 * who won the air, and the Ground Support that applied. Pure; `screens/report/BattleAir.tsx`
 * draws it.
 */

/** The air battle fought before a battle: the one over its territory with the same attacker. Meetings on the road have none. */
export function airBattleFor(outcomes: readonly TurnOutcome[], battle: BattleOutcome): AirBattleOutcome | undefined {
  const { site } = battle;
  if (site.kind === "meeting") return undefined;
  return outcomes.find((outcome): outcome is AirBattleOutcome =>
    outcome.kind === "air-battle" && outcome.territoryId === site.territoryId && outcome.input.attacker.factionId === battle.attackerFactionId);
}

/** One line of a side's panel: what it is, and what it adds to the roll. */
export interface AirLine {
  readonly label: string;
  readonly roll: number;
}

/** One side of the air battle, as the card shows it. */
export interface AirSideView {
  readonly factionId: FactionId;
  readonly faction: string;
  /** Its aircraft and AA; empty when it had neither. */
  readonly lines: readonly AirLine[];
  /** "No aircraft over Andalucía", when it had no aircraft there. */
  readonly none?: string;
  readonly die: number;
  /** "d20 6 + 2 = 8". */
  readonly sum: string;
  readonly wins: boolean;
}

export interface AirBattleView {
  readonly attacker: AirSideView;
  readonly defender: AirSideView;
  /** What the air battle decided, in a sentence. */
  readonly result: string;
}

const missionNames = { patrol: "on Patrol", support: "on Ground Support" } as const;

function sideView(scenario: Scenario, outcome: AirBattleOutcome, role: "attacker" | "defender"): AirSideView {
  const side: AirBattleSide = outcome.input[role];
  const die = outcome.result.rolls[role];
  const total = role === "attacker" ? outcome.result.attackerTotal : outcome.result.defenderTotal;
  const lines: AirLine[] = side.aircraft.map((aircraft) => ({ label: `${unitName(scenario, aircraft.unitId)} ${missionNames[aircraft.mission]}`, roll: aircraft.airRoll }));
  if (side.antiAir > 0) lines.push({ label: `Anti-air in ${territoryName(scenario, outcome.territoryId)}`, roll: side.antiAir });
  const bonus = total - die;
  return {
    die,
    faction: factionName(scenario, side.factionId),
    factionId: side.factionId,
    lines,
    ...(side.aircraft.length === 0 ? { none: `No aircraft over ${territoryName(scenario, outcome.territoryId)}` } : {}),
    sum: bonus === 0 ? `d20 ${String(die)} = ${String(total)}` : `d20 ${String(die)} + ${String(bonus)} = ${String(total)}`,
    wins: outcome.result.winner === role
  };
}

/** "+3 x 2 aircraft = +6": the support that applied, per aircraft when they add the same. */
function supportSum(outcome: AirBattleOutcome, role: "attacker" | "defender"): string {
  const { roll, unitIds } = outcome.support[role];
  const each = outcome.input[role].aircraft.filter((aircraft) => unitIds.includes(aircraft.unitId)).map((aircraft) => aircraft.supportRoll);
  const most = Math.max(...each);
  const count = `${String(unitIds.length)} aircraft`;
  return each.every((value) => value === most) ? `+${String(most)} ${glyphs.times} ${count} = +${String(roll)}` : `+${String(roll)} from ${count}`;
}

/** R11: what the air battle decided: the winner's Ground Support, or none. */
function resultLine(scenario: Scenario, outcome: AirBattleOutcome): string {
  const { winner } = outcome.result;
  if (winner === "tie") return "A tie in the air: neither side gets Ground Support.";
  const side = outcome.input[winner];
  const name = factionName(scenario, side.factionId);
  const roll = winner === "attacker" ? "attack" : "defence";
  if (outcome.support[winner].roll === 0) {
    const loser = winner === "attacker" ? "defender" : "attacker";
    return outcome.input[loser].aircraft.some((aircraft) => aircraft.mission === "support")
      ? `${name} wins the air: ${factionName(scenario, outcome.input[loser].factionId)}'s Ground Support does not count.`
      : `${name} wins the air, with no Ground Support of its own to give.`;
  }
  return `${name} wins the air: Ground Support ${supportSum(outcome, winner)} on the ${roll} roll.`;
}

/** The card's view of an air battle. */
export function airBattleView(scenario: Scenario, outcome: AirBattleOutcome): AirBattleView {
  return { attacker: sideView(scenario, outcome, "attacker"), defender: sideView(scenario, outcome, "defender"), result: resultLine(scenario, outcome) };
}

/** A roll as the card prints it: "+2". */
export function airRollLabel(roll: number): string {
  return `+${String(roll)}`;
}
