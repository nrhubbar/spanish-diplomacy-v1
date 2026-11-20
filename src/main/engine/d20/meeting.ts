import { type Armies, combatantsOf, compareIds, factionsOf, inScenarioOrder, removeArmies, replaceArmies } from "../board";
import type { BattleDice } from "../dice";
import type { MeetingResolution } from "../meeting";
import type { BattleOutcome, BouncedMoveOutcome, FactionId, MoveOrder, Scenario, TerritoryId, UnitId } from "../types";
import { fightGraded, type GradedBattle, type GradedInput, gradedOutcome, rollD20 } from "./battle";
import { fightingSurvivors } from "./grades";
import { gradedSide } from "./modifiers";

interface Meeting {
  readonly attackerFactionId: FactionId;
  readonly attackers: readonly MoveOrder[];
  readonly defenderFactionId: FactionId;
  readonly defenders: readonly MoveOrder[];
  readonly ends: readonly [TerritoryId, TerritoryId];
  readonly road: readonly [TerritoryId, TerritoryId];
}

/**
 * M20 on the d20. Exactly two factions moving along one connection in opposite directions meet
 * on the road; the greater attack attacks, and equal attacks bounce both. Meetings take no works,
 * faction modifiers, barricades or hooks (CT-44), only the armies' own modifiers (generals, unit
 * bonuses, fatigue), with the attackers' destination's weather. A grade with ground "all" lets
 * the attacker continue; a grade that cost the defender nothing lets the defender continue;
 * anything else (stalemates and partial ground, Q-D20-7) bounces both.
 */
export function resolveGradedMeetings(scenario: Scenario, input: GradedInput, start: Armies, advances: readonly MoveOrder[], dice: BattleDice): MeetingResolution {
  const meetings: Meeting[] = [];
  const bounced: BouncedMoveOutcome[] = [];
  for (const orders of roads(advances)) {
    const forward = orders.filter((order) => order.from === orders[0]?.from);
    const backward = orders.filter((order) => order.from !== orders[0]?.from);
    const ahead = opposed(forward, backward);
    const behind = opposed(backward, forward);
    const meeting = meetingOf(scenario, input, start, ahead, behind);
    if (meeting === undefined) bounced.push(...bounce(scenario, ahead, behind), ...bounce(scenario, behind, ahead));
    else meetings.push(meeting);
  }
  const stopped = new Set<UnitId>(bounced.map((outcome) => outcome.order.unitId));
  const battles: BattleOutcome[] = [];
  let armies = start;
  for (const [index, meeting] of [...meetings].sort(compareMeetings).entries()) {
    const battle = fightGraded(scenario, input, start, {
      attackerFactionId: meeting.attackerFactionId,
      attackers: combatantsOf(start, meeting.attackers),
      context: { attackerFactionId: meeting.attackerFactionId, defenderFactionIds: [meeting.defenderFactionId], diggingIn: false, weatherTerritoryId: meeting.road[1] },
      defenderRole: "defence",
      defenders: combatantsOf(start, meeting.defenders)
    }, index, rollD20(dice(index)));
    const winner = winnerOf(scenario, input, meeting, battle);
    const going = new Set((winner === meeting.attackerFactionId ? battle.attackerCasualties.survivors
      : winner === meeting.defenderFactionId ? battle.defenderCasualties.survivors : []).map((unit) => unit.id));
    for (const order of [...meeting.attackers, ...meeting.defenders]) if (!going.has(order.unitId)) stopped.add(order.unitId);
    const casualties = [battle.attackerCasualties, battle.defenderCasualties];
    armies = removeArmies(replaceArmies(armies, casualties.flatMap((side) => side.survivors)),
      casualties.flatMap((side) => side.losses.flatMap((loss) => (loss.destroyed ? [loss.unitId] : []))));
    battles.push(gradedOutcome({ ...battle, ground: 0 }, { between: meeting.road, kind: "meeting", ...(winner === undefined ? {} : { winner }) }, {
      demoralizedUnitIds: [...battle.attackerCasualties.demoralized, ...battle.defenderCasualties.demoralized],
      losses: [...battle.attackerCasualties.losses, ...battle.defenderCasualties.losses],
      retreats: [],
      surrenderedUnitIds: []
    }));
  }
  return { armies, battles, bounced, continuing: advances.filter((order) => !stopped.has(order.unitId) && armies[order.unitId] !== undefined) };
}

function winnerOf(scenario: Scenario, input: GradedInput, meeting: Meeting, battle: GradedBattle): FactionId | undefined {
  if (battle.grade.ground === "all" && fightingSurvivors(scenario, input.start, battle.attackerCasualties).length > 0) return meeting.attackerFactionId;
  return battle.grade.ground === 0 && battle.grade.defender.lossPercent === 0 ? meeting.defenderFactionId : undefined;
}

function roads(advances: readonly MoveOrder[]): readonly (readonly MoveOrder[])[] {
  const byRoad = new Map<string, MoveOrder[]>();
  for (const order of advances) {
    const key = [order.from, order.to].sort(compareIds).join("|");
    byRoad.set(key, [...(byRoad.get(key) ?? []), order]);
  }
  return [...byRoad.values()];
}

function opposed(direction: readonly MoveOrder[], opposite: readonly MoveOrder[]): readonly MoveOrder[] {
  return direction.filter((order) => opposite.some((other) => other.factionId !== order.factionId));
}

function meetingOf(scenario: Scenario, input: GradedInput, armies: Armies, ahead: readonly MoveOrder[], behind: readonly MoveOrder[]): Meeting | undefined {
  const [aheadFactionId, ...moreAhead] = factionsOf(ahead);
  const [behindFactionId, ...moreBehind] = factionsOf(behind);
  if (aheadFactionId === undefined || behindFactionId === undefined || moreAhead.length > 0 || moreBehind.length > 0 || aheadFactionId === behindFactionId) return undefined;
  const attack = (orders: readonly MoveOrder[]) => gradedSide(scenario, input.start, combatantsOf(armies, orders), "attack").value;
  const difference = attack(ahead) - attack(behind);
  if (difference === 0) return undefined;
  const [attackers, defenders, attackerFactionId, defenderFactionId] = difference > 0
    ? [ahead, behind, aheadFactionId, behindFactionId]
    : [behind, ahead, behindFactionId, aheadFactionId];
  const [lead] = attackers;
  if (lead === undefined) return undefined;
  const ends: readonly [TerritoryId, TerritoryId] = compareIds(lead.from, lead.to) < 0 ? [lead.from, lead.to] : [lead.to, lead.from];
  return { attackerFactionId, attackers, defenderFactionId, defenders, ends, road: [lead.from, lead.to] };
}

function bounce(scenario: Scenario, orders: readonly MoveOrder[], opposite: readonly MoveOrder[]): readonly BouncedMoveOutcome[] {
  return orders.map((order) => ({
    cause: { kind: "head-on", opposingFactionIds: inScenarioOrder(scenario, factionsOf(opposite)).filter((id) => id !== order.factionId) },
    kind: "bounced-move",
    order
  }));
}

function compareMeetings(left: Meeting, right: Meeting): number {
  return compareIds(left.ends[0], right.ends[0]) || compareIds(left.attackerFactionId, right.attackerFactionId) || compareIds(left.ends[1], right.ends[1]);
}
