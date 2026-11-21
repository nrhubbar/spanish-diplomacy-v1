import { describeRoute, legsOf } from "../movement/routes";
import type { GameState, MoveOrder, Scenario, SubTerritoryId } from "../types";
import type { LinkStep } from "./reach";

/**
 * U8: the sub-territories an order line passes, in order, so the map can draw a planned move
 * along the links it uses (`map-orders` turns them into points). Every step's ends are listed
 * once; a gap between steps (a march that enters a territory away from its station, then a
 * ride) is joined straight.
 */
export function pathPoints(path: readonly LinkStep[]): readonly SubTerritoryId[] {
  const points: SubTerritoryId[] = [];
  for (const step of path) {
    if (points[points.length - 1] !== step.from) points.push(step.from);
    points.push(step.to);
  }
  return points;
}

/**
 * U8: the line of a planned move, as sub-territory ids, read from the same route the engine
 * checks (`describeRoute`). Empty when the order no longer describes a route, or in a scenario
 * without links.
 */
export function orderLine(scenario: Scenario, state: GameState, order: Pick<MoveOrder, "factionId" | "from" | "legs" | "to" | "unitId">): readonly SubTerritoryId[] {
  const check = describeRoute(scenario, state, order.factionId, order.from, legsOf(scenario, order), true, undefined, [order.unitId]);
  return check.ok ? pathPoints(check.route.path) : [];
}
