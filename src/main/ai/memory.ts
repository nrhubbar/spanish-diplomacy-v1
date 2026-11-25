import type { FactionId, TerritoryId, TurnOutcome, UnitId } from "../engine/types";

/** What a computer player learns from the revealed outcomes of earlier turns. */

/**
 * Moves that failed last turn: moves that bounced without a battle, and attacks on a territory
 * the faction did not take. Since Revision 6 a failed attack is a battle, not a bounce (M17).
 */
export function bouncedMoves(outcomes: readonly TurnOutcome[], factionId: FactionId): ReadonlySet<string> {
  return new Set(outcomes.flatMap((outcome): string[] => {
    if (outcome.kind === "bounced-move") {
      return outcome.order.factionId === factionId ? [moveKey(outcome.order.unitId, outcome.order.from, outcome.order.to)] : [];
    }
    if (outcome.kind !== "battle" || outcome.attackerFactionId !== factionId || (outcome.site.kind !== "assault" && outcome.site.kind !== "entry")) {
      return [];
    }
    const { occupation, territoryId } = outcome.site;
    return occupation.kind === "taken" && occupation.factionId === factionId
      ? []
      : outcome.attacker.armies.map((army) => moveKey(army.unitId, army.from, territoryId));
  }));
}

export function moveKey(unitId: UnitId, from: TerritoryId, to: TerritoryId): string {
  return `${unitId}:${from}:${to}`;
}

/**
 * Turns in a row, counting back from the last, in which the faction gained no ground: no
 * move into territory it did not hold, and no battle that gave it the territory.
 */
export function stalledTurns(history: readonly (readonly TurnOutcome[])[], factionId: FactionId): number {
  let turns = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if ((history[index] ?? []).some((outcome) => gained(outcome, factionId))) break;
    turns += 1;
  }
  return turns;
}

function gained(outcome: TurnOutcome, factionId: FactionId): boolean {
  if (outcome.kind === "successful-move") return outcome.order.factionId === factionId;
  if (outcome.kind !== "battle" || outcome.site.kind === "meeting") return false;
  const { occupation } = outcome.site;
  return occupation.kind === "taken" && occupation.factionId === factionId;
}

/** A unit's trip in an earlier turn, whether it took ground, reinforced, attacked or bounced. */
export interface Trip {
  readonly from: TerritoryId;
  readonly to: TerritoryId;
  readonly unitId: UnitId;
}

/** The trips a faction's units made in a turn. */
export function tripsMade(outcomes: readonly TurnOutcome[], factionId: FactionId): readonly Trip[] {
  return outcomes.flatMap((outcome): readonly Trip[] => {
    if (outcome.kind === "successful-move" || outcome.kind === "reinforcement-arrived" || outcome.kind === "bounced-move") {
      const { from, to, unitId } = outcome.order;
      return outcome.order.factionId === factionId ? [{ from, to, unitId }] : [];
    }
    if (outcome.kind !== "battle" || outcome.attackerFactionId !== factionId || (outcome.site.kind !== "assault" && outcome.site.kind !== "entry")) return [];
    const { territoryId } = outcome.site;
    return outcome.attacker.armies.map((army) => ({ from: army.from, to: territoryId, unitId: army.unitId }));
  });
}
