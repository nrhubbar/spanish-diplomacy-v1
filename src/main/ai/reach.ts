import { neighborsOf } from "../engine/lookup";
import { unitTypeOf } from "../engine/movement/network";
import { isContested } from "../engine/partition/holders";
import { type MoveRoute, moveRoutes } from "../engine/movement/routes";
import type { GameState, Scenario, TerritoryId, UnitId, UnitState } from "../engine/types";

/** Whether the unit is a transport (trucks), which goes with an army rather than marching alone. */
export function isTransport(scenario: Scenario, state: GameState, unitId: UnitId): boolean {
  return (unitTypeOf(scenario, state, unitId)?.effects ?? []).some((effect) => effect.kind === "transport");
}

/**
 * M1-M5: the routes a unit could take this turn under `allowance`, with the trucks standing with
 * it, rail and sea included. Remembered per state for units alike (faction, origin, mobility,
 * morale), since planning asks for the same origins many times.
 */
export function unitRoutes(scenario: Scenario, state: GameState, unit: UnitState): ReadonlyMap<TerritoryId, MoveRoute> {
  const memo = routeMemo.get(state) ?? new Map<string, ReadonlyMap<TerritoryId, MoveRoute>>();
  routeMemo.set(state, memo);
  const mobile = (unitTypeOf(scenario, state, unit.id)?.effects ?? []).some((effect) => effect.kind === "mobile");
  const key = `${scenario.id}|${unit.factionId}|${unit.territoryId}|${String(mobile)}|${String(unit.morale.demoralized)}`;
  const known = memo.get(key);
  if (known !== undefined) return known;
  const trucks = Object.values(state.units).filter((other) => other.territoryId === unit.territoryId && other.factionId === unit.factionId && isTransport(scenario, state, other.id));
  const routes = moveRoutes(scenario, state, unit.factionId, unit.territoryId, [unit.id, ...trucks.map((truck) => truck.id)]);
  memo.set(key, routes);
  return routes;
}

const routeMemo = new WeakMap<GameState, Map<string, ReadonlyMap<TerritoryId, MoveRoute>>>();

/**
 * D23: where a unit could strike this turn, as a threat: its own territory, the territories next
 * to it, and under `allowance` every destination its routes offer (rail, trucks and sea), so a
 * rail-borne threat counts. Units that cannot march (aircraft, trucks, units held in contested
 * ground, C1) reach only their own territory and its neighbours, as before.
 */
export function threatReach(scenario: Scenario, state: GameState, unit: UnitState): ReadonlySet<TerritoryId> {
  const reach = new Set<TerritoryId>([unit.territoryId, ...neighborsOf(scenario, unit.territoryId).map((neighbor) => neighbor.territoryId)]);
  if (scenario.rules.movement !== "allowance" || isTransport(scenario, state, unit.id)) return reach;
  if (!(unitTypeOf(scenario, state, unit.id)?.orders.includes("move") ?? true) || isContested(scenario, state, unit.territoryId)) return reach;
  for (const to of unitRoutes(scenario, state, unit).keys()) reach.add(to);
  return reach;
}
