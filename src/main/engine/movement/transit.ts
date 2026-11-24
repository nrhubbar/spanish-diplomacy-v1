import { placeAt, replaceArmies, requireArmy } from "../board";
import { classifyMoves } from "../orders";
import type { Phase } from "../phases/draft";
import type {
  FactionId,
  GameState,
  HeldBackCause,
  MoveHeldBackOutcome,
  MoveInterceptedOutcome,
  MoveLeg,
  MoveOrder,
  MoveTransitOutcome,
  Scenario,
  SubTerritoryId,
  SystemOutcome,
  TerritoryId,
  UnitId
} from "../types";
import { hasFighter } from "../units/fighting";
import { armyAllowance, fitsAllowance, transportOf } from "./allowance";
import { portLandings, railPlaces } from "./network";
import { armyKey, describeRoute, legsOf, type MoveRoute, railShortage, type RouteCheck, routeClaims } from "./routes";

/** The movement area's turn-only data (`TurnScratch.movement`). */
export interface MovementScratch {
  /** Each moving unit's route, as checked at reveal. */
  readonly routes: ReadonlyMap<UnitId, MoveRoute>;
  /** Each moving unit's order as submitted, before transit shortened it to its last step. */
  readonly submitted: ReadonlyMap<UnitId, MoveOrder>;
}

interface Army {
  readonly key: string;
  readonly orders: readonly [MoveOrder, ...MoveOrder[]];
}

/** W4: the valid moves grouped into armies, in the order their first unit was ordered. */
export function armiesOf(scenarioKey: (order: MoveOrder) => string, orders: readonly MoveOrder[]): readonly Army[] {
  const groups = new Map<string, [MoveOrder, ...MoveOrder[]]>();
  for (const order of orders) {
    const key = scenarioKey(order);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [order]);
    else group.push(order);
  }
  return [...groups].map(([key, group]) => ({ key, orders: group }));
}

/** The route an army's orders take from the start-of-turn state, as checked at reveal. */
function armyRoute(scenario: Scenario, state: GameState, orders: readonly [MoveOrder, ...MoveOrder[]]): RouteCheck {
  const [first] = orders;
  const unitIds = orders.map((order) => order.unitId);
  const { allMobile } = transportOf(scenario, state, unitIds);
  return describeRoute(scenario, state, first.factionId, first.from, legsOf(scenario, first), allMobile, undefined, unitIds);
}

/**
 * The route each planned move would take, for a planning estimate that knows how every attacker
 * travels: the moves are grouped into armies (W4) and described as at reveal. A move with no
 * route has no entry.
 */
export function routesOfMoves(scenario: Scenario, state: GameState, moves: readonly MoveOrder[]): ReadonlyMap<UnitId, MoveRoute> {
  const routes = new Map<UnitId, MoveRoute>();
  for (const army of armiesOf((order) => armyKey(scenario, order), moves)) {
    const check = armyRoute(scenario, state, army.orders);
    if (check.ok) for (const order of army.orders) routes.set(order.unitId, check.route);
  }
  return routes;
}

/**
 * Step 1, the `allowance` module's part (M1, M3, M5). Each order's legs were checked on their
 * own; here the moves are grouped into armies (W4) and checked as armies: the route must fit the
 * army's allowance, and its boarding capital's trains, landing port or sea lane must have room. The
 * trains take an army whole, a place for each of its units, or not at all (D5). Armies
 * are served in the order their first unit was ordered. D27.1: an army with no unit that can
 * fight (generals, trucks, anti-air) may not advance; it may only reinforce its own side. An army
 * that cannot go stays where it is, with its standing order; nothing is disbanded. The rest are
 * sorted again into reinforcements and advances (M11).
 */
export const checkArmies: Phase = (draft) => {
  const { scenario, start } = draft.input;
  const held: MoveHeldBackOutcome[] = [];
  const routes = new Map<UnitId, MoveRoute>();
  const departures = new Map<SubTerritoryId, number>();
  const landings = new Map<string, number>();
  const lanes = new Map<string, number>();
  const heldUnits = new Set<UnitId>();
  const advancing = new Set(classifyMoves(scenario, start, draft.armies, draft.orders.valid).advances.map((order) => order.unitId));
  for (const army of armiesOf((order) => armyKey(scenario, order), draft.orders.valid)) {
    const [first] = army.orders;
    const unitIds = army.orders.map((order) => order.unitId);
    const check = armyRoute(scenario, start, army.orders);
    const places = railPlaces(scenario, start, unitIds);
    const cause = ((): HeldBackCause | undefined => {
      if (!check.ok) return { reason: "allowance" };
      const { route } = check;
      if (unitIds.some((unitId) => advancing.has(unitId)) && !hasFighter(scenario, start.raised, unitIds)) return { reason: "cannot-fight" };
      if (!fitsAllowance(route.cost, route.steps, armyAllowance(scenario, start, first.factionId, first.from, unitIds))) return { reason: "allowance" };
      const claims = routeClaims(route);
      const rail = railShortage(scenario, start, { places, route }, { departures });
      if (rail !== undefined) return { rail, reason: "rail-full" };
      // A port lands only its holder's armies, so landings count per port (M5).
      const landingKey = claims.landing;
      if (landingKey !== undefined && (landings.get(landingKey) ?? 0) >= portLandings(scenario, route.sea?.level ?? 0)) return { reason: "port-landings" };
      const laneKey = claims.amphibious === undefined ? undefined : `${first.factionId}|${claims.amphibious}`;
      if (laneKey !== undefined && (lanes.get(laneKey) ?? 0) >= 1) return { reason: "amphibious-lane" };
      if (claims.departure !== undefined) departures.set(claims.departure, (departures.get(claims.departure) ?? 0) + places);
      if (landingKey !== undefined) landings.set(landingKey, (landings.get(landingKey) ?? 0) + 1);
      if (laneKey !== undefined) lanes.set(laneKey, (lanes.get(laneKey) ?? 0) + 1);
      return undefined;
    })();
    if (cause === undefined && check.ok) {
      for (const unitId of unitIds) routes.set(unitId, check.route);
    } else {
      for (const unitId of unitIds) heldUnits.add(unitId);
      held.push({ factionId: first.factionId, from: first.from, kind: "move-held-back", ...(cause ?? { reason: "allowance" as const }), to: first.to, unitIds });
    }
  }
  const valid = draft.orders.valid.filter((order) => !heldUnits.has(order.unitId));
  const { advances, reinforcements } = classifyMoves(scenario, start, draft.armies, valid);
  const origins = new Map([...draft.orders.origins].filter(([unitId]) => !heldUnits.has(unitId)));
  const submitted = new Map(valid.map((order) => [order.unitId, order]));
  return {
    ...draft,
    events: [...draft.events, ...held],
    orders: { ...draft.orders, advances, origins, reinforcements, valid },
    scratch: { ...draft.scratch, movement: { routes, submitted } }
  };
};

/** The legs of a route cut short at `stop`: up to the leg that ends there, or a ride cut at a territory the train passes. */
function legsTo(route: MoveRoute, stop: TerritoryId): readonly MoveLeg[] {
  const legs: MoveLeg[] = [];
  for (const leg of route.legs) {
    if (leg.kind === "rail" && route.rail?.through.includes(stop) === true) return [...legs, { kind: "rail", to: stop }];
    legs.push(leg);
    if (leg.to === stop) return legs;
  }
  return legs;
}

/**
 * Step 3, the `allowance` module's part (M2-M5, Q-UX-I3, T4).
 * - An army whose route stops in a territory (`transit`) that another faction's army is
 *   entering this turn stops at the first such territory and defends it as a reinforcement.
 *   A rail ride is stopped at any territory the train passes as well as at its end (Q-MR-16).
 * - Every other move that is not a reinforcement goes to the territory its last leg starts
 *   from, and from there it is an ordinary one-step move for the meeting and territory battles
 *   (steps 4 and 5): a bounced army returns there.
 * - Reinforcements arrive (M11).
 * Frostbite (T4) is the weather module's step-9 part (`m3r1-weather-timer`, WT-5).
 */
export const moveAlongRoutes: Phase = (draft) => {
  const { scenario } = draft.input;
  const routes = draft.scratch.movement?.routes ?? new Map<UnitId, MoveRoute>();
  const entering = new Map<TerritoryId, Set<FactionId>>();
  for (const order of draft.orders.valid) {
    const set = entering.get(order.to) ?? new Set<FactionId>();
    set.add(order.factionId);
    entering.set(order.to, set);
  }
  const reinforcing = new Set(draft.orders.reinforcements.map((order) => order.unitId));
  const replaced = new Map<UnitId, MoveOrder>();
  const intercepted = new Set<UnitId>();
  const staged = new Map<UnitId, TerritoryId>();
  const events: SystemOutcome[] = [];
  const interceptions = new Map<string, MoveInterceptedOutcome>();
  const transits = new Map<string, MoveTransitOutcome>();

  for (const order of draft.orders.valid) {
    const route = routes.get(order.unitId);
    if (route === undefined || route.transit.length === 0) continue;
    const key = armyKey(scenario, order);
    const stop = route.transit.find((territoryId) => [...(entering.get(territoryId) ?? [])].some((factionId) => factionId !== order.factionId));
    if (stop !== undefined) {
      replaced.set(order.unitId, { ...order, legs: legsTo(route, stop), to: stop });
      intercepted.add(order.unitId);
      const by = [...(entering.get(stop) ?? [])].filter((factionId) => factionId !== order.factionId).sort();
      const outcome = interceptions.get(key);
      interceptions.set(key, { byFactionIds: by, factionId: order.factionId, from: order.from, kind: "move-intercepted", stoppedAt: stop, to: order.to, unitIds: [...(outcome?.unitIds ?? []), order.unitId] });
      continue;
    }
    if (route.legs.length === 1) continue;
    const transit = transits.get(key);
    transits.set(key, { factionId: order.factionId, from: order.from, kind: "move-transit", legs: route.legs, to: order.to, unitIds: [...(transit?.unitIds ?? []), order.unitId] });
    if (!reinforcing.has(order.unitId)) {
      const last = route.legs[route.legs.length - 1];
      if (last === undefined) continue;
      replaced.set(order.unitId, { ...order, from: route.staging, legs: [last] });
      staged.set(order.unitId, route.staging);
    }
  }
  events.push(...transits.values(), ...interceptions.values());

  const swap = (order: MoveOrder): MoveOrder => replaced.get(order.unitId) ?? order;
  const valid = draft.orders.valid.map(swap);
  const advances = draft.orders.advances.filter((order) => !intercepted.has(order.unitId)).map(swap);
  const reinforcements = [
    ...draft.orders.reinforcements.map(swap),
    ...draft.orders.advances.filter((order) => intercepted.has(order.unitId)).map(swap)
  ];
  const origins = new Map(draft.orders.origins);
  for (const [unitId, staging] of staged) origins.set(unitId, staging);

  let armies = draft.armies;
  armies = replaceArmies(armies, [...staged].map(([unitId, staging]) => placeAt(requireArmy(armies, unitId), staging)));
  armies = replaceArmies(armies, reinforcements.map((order) => placeAt(requireArmy(armies, order.unitId), order.to)));

  return {
    ...draft,
    armies,
    events: [...draft.events, ...events],
    orders: { ...draft.orders, advances, origins, reinforcements, valid }
  };
};
