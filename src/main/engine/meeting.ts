import { battleOutcome, fight, type FoughtBattle, sideOf, survivorIds } from "./battle";
import { type Armies, combatantsOf, compareIds, factionsOf, inScenarioOrder, removeArmies, replaceArmies } from "./board";
import { isSuccessful } from "./combat";
import { type BattleDice, rollDie } from "./dice";
import type { BattleOutcome, BouncedMoveOutcome, FactionId, MoveOrder, Scenario, TerritoryId, UnitId } from "./types";

/** The result of the head-on step (M20). */
export interface MeetingResolution {
  readonly armies: Armies;
  readonly battles: readonly BattleOutcome[];
  /** Head-on moves that bounced without a battle. */
  readonly bounced: readonly BouncedMoveOutcome[];
  /** Moves still on their way: every advance not stopped on the road, its army alive. */
  readonly continuing: readonly MoveOrder[];
}

interface Meeting {
  readonly attackerFactionId: FactionId;
  readonly attackers: readonly MoveOrder[];
  readonly defenderFactionId: FactionId;
  readonly defenders: readonly MoveOrder[];
  /** The road's territories in id order, for M26 indexing. */
  readonly ends: readonly [TerritoryId, TerritoryId];
  /** The road: the attackers' origin and destination. */
  readonly road: readonly [TerritoryId, TerritoryId];
}

/**
 * M20 (C9): armies of exactly two factions moving along one connection in opposite directions
 * meet on the road. The side with the greater attack attacks, without works or faction
 * modifiers; equal attacks bounce both. The winner continues; the loser takes its result and is
 * back at its origin, where it defends if attacked. With more than two factions, every move that
 * meets another faction bounces. Reinforcements (M11) are not on the road and take no part.
 */
export function resolveMeetings(
  scenario: Scenario,
  start: Armies,
  advances: readonly MoveOrder[],
  dice: BattleDice
): MeetingResolution {
  const meetings: Meeting[] = [];
  const bounced: BouncedMoveOutcome[] = [];
  for (const orders of roads(advances)) {
    const forward = orders.filter((order) => order.from === orders[0]?.from);
    const backward = orders.filter((order) => order.from !== orders[0]?.from);
    const ahead = opposed(forward, backward);
    const behind = opposed(backward, forward);
    const meeting = meetingOf(scenario, start, ahead, behind);
    if (meeting === undefined) {
      bounced.push(...bounce(scenario, ahead, behind), ...bounce(scenario, behind, ahead));
    } else {
      meetings.push(meeting);
    }
  }

  const stopped = new Set<UnitId>(bounced.map((outcome) => outcome.order.unitId));
  const battles: BattleOutcome[] = [];
  let armies = start;
  for (const [index, meeting] of [...meetings].sort(compareMeetings).entries()) {
    const battle = fight(scenario, start, {
      attackerFactionId: meeting.attackerFactionId,
      attackers: combatantsOf(start, meeting.attackers),
      defenderRole: "defence",
      defenders: combatantsOf(start, meeting.defenders),
      situational: []
    }, index, rollDie(dice(index)));
    const winner = winnerOf(meeting, battle);
    const going = winner === meeting.attackerFactionId ? survivorIds(battle.attackerCasualties)
      : winner === meeting.defenderFactionId ? survivorIds(battle.defenderCasualties) : new Set<UnitId>();
    for (const order of [...meeting.attackers, ...meeting.defenders]) {
      if (!going.has(order.unitId)) stopped.add(order.unitId);
    }
    armies = applyCasualties(armies, battle);
    battles.push(battleOutcome(battle, {
      between: meeting.road,
      kind: "meeting",
      ...(winner === undefined ? {} : { winner })
    }, {
      demoralizedUnitIds: [...battle.attackerCasualties.demoralized, ...battle.defenderCasualties.demoralized],
      losses: [...battle.attackerCasualties.losses, ...battle.defenderCasualties.losses],
      retreats: [],
      surrenderedUnitIds: []
    }));
  }
  return {
    armies,
    battles,
    bounced,
    continuing: advances.filter((order) => !stopped.has(order.unitId) && armies[order.unitId] !== undefined)
  };
}

/** Advances grouped by the connection they use, in first-seen order. */
function roads(advances: readonly MoveOrder[]): readonly (readonly MoveOrder[])[] {
  const byRoad = new Map<string, MoveOrder[]>();
  for (const order of advances) {
    const key = [order.from, order.to].sort(compareIds).join("|");
    byRoad.set(key, [...(byRoad.get(key) ?? []), order]);
  }
  return [...byRoad.values()];
}

/** Moves in one direction that some other faction's move in the opposite direction meets. */
function opposed(direction: readonly MoveOrder[], opposite: readonly MoveOrder[]): readonly MoveOrder[] {
  return direction.filter((order) => opposite.some((other) => other.factionId !== order.factionId));
}

/**
 * A battle when exactly two factions meet, one in each direction, with different attacks: the
 * greater attacks. Otherwise undefined, and every move that met another faction bounces.
 */
function meetingOf(scenario: Scenario, armies: Armies, ahead: readonly MoveOrder[], behind: readonly MoveOrder[]): Meeting | undefined {
  const [aheadFactionId, ...moreAhead] = factionsOf(ahead);
  const [behindFactionId, ...moreBehind] = factionsOf(behind);
  if (aheadFactionId === undefined || behindFactionId === undefined || moreAhead.length > 0 || moreBehind.length > 0 || aheadFactionId === behindFactionId) {
    return undefined;
  }
  const attack = (orders: readonly MoveOrder[]) => sideOf(scenario, combatantsOf(armies, orders), "attack").value;
  const difference = attack(ahead) - attack(behind);
  if (difference === 0) {
    return undefined;
  }
  const [attackers, defenders, attackerFactionId, defenderFactionId] = difference > 0
    ? [ahead, behind, aheadFactionId, behindFactionId]
    : [behind, ahead, behindFactionId, aheadFactionId];
  const [lead] = attackers;
  if (lead === undefined) {
    return undefined;
  }
  const ends: readonly [TerritoryId, TerritoryId] = compareIds(lead.from, lead.to) < 0 ? [lead.from, lead.to] : [lead.to, lead.from];
  return { attackerFactionId, attackers, defenderFactionId, defenders, ends, road: [lead.from, lead.to] };
}

/** M20: a success lets the attacker continue; any attacker result lets the defender; both demoralized, neither. */
function winnerOf(meeting: Meeting, battle: FoughtBattle): FactionId | undefined {
  if (isSuccessful(battle.face.result)) {
    return meeting.attackerFactionId;
  }
  return battle.face.result === "both-demoralized" ? undefined : meeting.defenderFactionId;
}

function bounce(scenario: Scenario, orders: readonly MoveOrder[], opposite: readonly MoveOrder[]): readonly BouncedMoveOutcome[] {
  return orders.map((order) => ({
    cause: { kind: "head-on", opposingFactionIds: inScenarioOrder(scenario, factionsOf(opposite)).filter((id) => id !== order.factionId) },
    kind: "bounced-move",
    order
  }));
}

function applyCasualties(armies: Armies, battle: FoughtBattle): Armies {
  const casualties = [battle.attackerCasualties, battle.defenderCasualties];
  const destroyed = casualties.flatMap((side) => side.losses.flatMap((loss) => (loss.destroyed ? [loss.unitId] : [])));
  return removeArmies(replaceArmies(armies, casualties.flatMap((side) => side.survivors)), destroyed);
}

/** M26: meetings by the lower id of their two territories, then attacking faction, then the other id. */
function compareMeetings(left: Meeting, right: Meeting): number {
  return compareIds(left.ends[0], right.ends[0])
    || compareIds(left.attackerFactionId, right.attackerFactionId)
    || compareIds(left.ends[1], right.ends[1]);
}
