import type { FactionId, GameState, MoveLeg, Scenario, SubTerritoryId, TerritoryId } from "../types";
import { holderOf, subTerritoriesOf } from "./network";

/**
 * P6: a Withdraw, or a forced retreat, leaves a territory through the mover's own
 * sub-territories, to an adjacent territory it held at the start of the turn. This is the
 * movement area's step-6 use of the path rule.
 *
 * TODO(m3r1-sub-territories): replace `ownPath` with the sub-territories stream's path function
 * when it lands; it stands in for it with the same rule, so callers need not change.
 */

/**
 * The sub-territories, in order, from any the faction holds in `from` to one bordering `to`,
 * crossing only sub-territories of `from` the faction holds; undefined when there is none.
 */
export function ownPath(scenario: Scenario, state: GameState, factionId: FactionId, from: TerritoryId, to: TerritoryId): readonly SubTerritoryId[] | undefined {
  const inside = new Set(subTerritoriesOf(scenario, from).filter((id) => holderOf(state, id) === factionId));
  const across = new Set(subTerritoriesOf(scenario, to));
  const borders = (id: SubTerritoryId): readonly SubTerritoryId[] => scenario.index.subTerritoryNeighbors.get(id) ?? [];
  const queue = [...inside];
  const previous = new Map<SubTerritoryId, SubTerritoryId | undefined>(queue.map((id) => [id, undefined]));
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    if (borders(current).some((next) => across.has(next))) {
      const path: SubTerritoryId[] = [];
      for (let at: SubTerritoryId | undefined = current; at !== undefined; at = previous.get(at)) path.unshift(at);
      return path;
    }
    for (const next of borders(current)) {
      if (!inside.has(next) || previous.has(next)) continue;
      previous.set(next, current);
      queue.push(next);
    }
  }
  return undefined;
}

/**
 * P6: the legs of a Withdraw from `from` to `to`, read against the start-of-turn state: one land
 * step, when `to` is adjacent, was held by the faction at the start of the turn, and is reached
 * through the faction's own sub-territories. Undefined means the army has no way out and
 * surrenders.
 */
export function withdrawLegs(scenario: Scenario, start: GameState, factionId: FactionId, from: TerritoryId, to: TerritoryId): readonly MoveLeg[] | undefined {
  const control = start.control[to];
  const heldAtStart = control?.kind === "controlled" && control.factionId === factionId;
  const adjacent = scenario.connections.some((connection) => connection.kind === "land" && connection.between.includes(from) && connection.between.includes(to));
  if (!heldAtStart || !adjacent || ownPath(scenario, start, factionId, from, to) === undefined) return undefined;
  return [{ kind: "land", to }];
}
