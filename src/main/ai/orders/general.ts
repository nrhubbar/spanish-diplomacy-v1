import { isGroundUnit, unitKindIn } from "../../engine/air/pieces";
import { compareIds } from "../../engine/board";
import { neighborsOf } from "../../engine/lookup";
import type { MoveOrder, TerritoryId, UnitId } from "../../engine/types";
import { validateMoveOrder } from "../../engine/validation";
import type { OrderPlanner } from "./planner";

/**
 * H5, U5: where the computer player's generals go. A general goes with the biggest group of
 * ground units the move planner sends from his territory to ground the faction does not hold
 * (an attack, where his +1 counts), unless more units stay behind than go. A general with no
 * ground units of his faction around him steps toward the nearest territory that has some,
 * through ground his faction controls. Ties break by territory id.
 */
export const planGeneralMoves: OrderPlanner<MoveOrder> = ({ factionId, planned, scenario, state }) => {
  const ordered = new Set(planned.flatMap((order) => ("unitId" in order ? [order.unitId] : [])));
  const generals = Object.values(state.units)
    .filter((unit) => unit.factionId === factionId && !ordered.has(unit.id) && unitKindIn(scenario, state.raised, unit.id) === "general")
    .sort((a, b) => compareIds(a.id, b.id));
  const ground = Object.values(state.units).filter((unit) => unit.factionId === factionId && isGroundUnit(scenario, state.raised, unit.id));
  const moves = planned.filter((order): order is MoveOrder => order.kind === "move" && order.factionId === factionId);
  const controlled = (id: TerritoryId): boolean => {
    const control = state.control[id];
    return control?.kind === "controlled" && control.factionId === factionId;
  };
  const orders: MoveOrder[] = [];
  for (const general of generals) {
    const here = ground.filter((unit) => unit.territoryId === general.territoryId);
    const leaving = moves.filter((order) => order.from === general.territoryId);
    const staying = here.filter((unit) => !leaving.some((order) => order.unitId === unit.id));
    const groups = new Map<TerritoryId, UnitId[]>();
    for (const order of leaving) groups.set(order.to, [...(groups.get(order.to) ?? []), order.unitId]);
    const attack = [...groups.entries()]
      .filter(([to]) => !controlled(to))
      .sort((a, b) => b[1].length - a[1].length || compareIds(a[0], b[0]))[0];
    let to: TerritoryId | undefined;
    if (attack !== undefined && attack[1].length >= staying.length) to = attack[0];
    else if (here.length === 0) to = stepToward(general.territoryId, ground.map((unit) => unit.territoryId));
    if (to === undefined) continue;
    // M4: he takes his army's route (rail, sea, march), so he joins that army and its boarding place.
    const legs = leaving.find((candidate) => candidate.to === to)?.legs;
    const order: MoveOrder = { factionId, from: general.territoryId, kind: "move", ...(legs === undefined ? {} : { legs }), to, unitId: general.id };
    if (validateMoveOrder(scenario, state, order).ok) orders.push(order);
  }
  return orders;

  /** The first step of a shortest path through controlled ground to any of `targets`. */
  function stepToward(from: TerritoryId, targets: readonly TerritoryId[]): TerritoryId | undefined {
    const wanted = new Set(targets);
    const first = new Map<TerritoryId, TerritoryId>();
    let frontier: TerritoryId[] = [from];
    const seen = new Set<TerritoryId>([from]);
    while (frontier.length > 0) {
      const next: TerritoryId[] = [];
      for (const id of frontier) {
        for (const neighbor of [...neighborsOf(scenario, id)].sort((a, b) => compareIds(a.territoryId, b.territoryId))) {
          const to = neighbor.territoryId;
          if (seen.has(to) || !controlled(to)) continue;
          seen.add(to);
          const step = first.get(id) ?? to;
          if (wanted.has(to)) return step;
          first.set(to, step);
          next.push(to);
        }
      }
      frontier = next;
    }
    return undefined;
  }
};
