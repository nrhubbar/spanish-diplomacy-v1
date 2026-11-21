import { neighborsOf } from "../engine/lookup";
import { isFriendlyGround, landNeighbors, unitTypeOf } from "../engine/movement/network";
import { hasLinks } from "../engine/network/links";
import { allFoot, motorPath, startSubTerritories } from "../engine/network/paths";
import { isContested } from "../engine/partition/holders";
import { type MoveRoute, moveRoutes } from "../engine/movement/routes";
import type { FactionId, GameState, Scenario, TerritoryId, UnitId, UnitState } from "../engine/types";

/** Whether the unit is a transport (trucks), which goes with an army rather than marching alone. */
export function isTransport(scenario: Scenario, state: GameState, unitId: UnitId): boolean {
  return (unitTypeOf(scenario, state, unitId)?.effects ?? []).some((effect) => effect.kind === "transport");
}

/**
 * M1-M5, R5: the routes a unit could take this turn under `allowance`, with the trucks standing
 * with it, rail and sea included. These are the routes `reachFor` reports (it reads the same
 * `moveRoutes`), so the computer player picks March, Motor, Rail or Sea as the rules offer them,
 * passes and pockets included. A foot unit also keeps the March a truck would bar: trucks are not
 * foot, so a link with no road takes the unit alone. Remembered per state for units alike
 * (faction, origin, mobility, foot, morale), since planning asks for the same origins many times.
 * The pocket (R1) needs no key: uncontested ground is one pocket, and no move leaves contested ground (C1).
 */
export function unitRoutes(scenario: Scenario, state: GameState, unit: UnitState): ReadonlyMap<TerritoryId, MoveRoute> {
  const memo = routeMemo.get(state) ?? new Map<string, ReadonlyMap<TerritoryId, MoveRoute>>();
  routeMemo.set(state, memo);
  const mobile = (unitTypeOf(scenario, state, unit.id)?.effects ?? []).some((effect) => effect.kind === "mobile");
  const foot = allFoot(scenario, state, [unit.id]);
  const key = `${scenario.id}|${unit.factionId}|${unit.territoryId}|${String(mobile)}|${String(foot)}|${String(unit.morale.demoralized)}`;
  const known = memo.get(key);
  if (known !== undefined) return known;
  const trucks = Object.values(state.units).filter((other) => other.territoryId === unit.territoryId && other.factionId === unit.factionId && isTransport(scenario, state, other.id));
  const carried = moveRoutes(scenario, state, unit.factionId, unit.territoryId, [unit.id, ...trucks.map((truck) => truck.id)]);
  const routes = trucks.length === 0 || !foot ? carried : new Map([...moveRoutes(scenario, state, unit.factionId, unit.territoryId, [unit.id]), ...carried]);
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

/**
 * R5: whether trucks pay in a territory: from the faction's ground there, a Motor route runs two
 * territories on, along main roads through friendly ground, never over a pass, into uncontested
 * ground. Trucks carry nothing else (a single step always fits, M1), so without such a road they
 * are wasted. Without links every two-step march is Motor. It reads the faction's whole ground there,
 * which is one pocket at a recruit site (uncontested ground).
 */
export function motorPays(scenario: Scenario, state: GameState, factionId: FactionId, territoryId: TerritoryId): boolean {
  if (!hasLinks(scenario)) return true;
  const start = startSubTerritories(scenario, state, factionId, territoryId);
  return landNeighbors(scenario, territoryId).some((via) => isFriendlyGround(scenario, state, factionId, via)
    && landNeighbors(scenario, via).some((to) => to !== territoryId && !isContested(scenario, state, to) && motorPath(scenario, state, start, [via, to]).ok));
}
