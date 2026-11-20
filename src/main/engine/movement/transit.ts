import { placeAt, replaceArmies, requireArmy } from "../board";
import { classifyMoves } from "../orders";
import type { Phase } from "../phases/draft";
import type {
  FactionId,
  HeldBackReason,
  MoveHeldBackOutcome,
  MoveInterceptedOutcome,
  MoveOrder,
  MoveTransitOutcome,
  SystemOutcome,
  TerritoryId,
  UnitId
} from "../types";
import { armyAllowance, fitsAllowance, transportOf } from "./allowance";
import { portLandings, railDepartures } from "./network";
import { armyKey, describeRoute, legsOf, type MoveRoute, routeClaims } from "./routes";

/** The movement area's turn-only data (`TurnScratch.movement`). */
export interface MovementScratch {
  /** Each moving unit's route, as checked at reveal. */
  readonly routes: ReadonlyMap<UnitId, MoveRoute>;
  /** Each moving unit's order as submitted, before transit shortened it to its last step. */
  readonly submitted: ReadonlyMap<UnitId, MoveOrder>;
}

interface Army {
  readonly key: string;
  readonly orders: readonly MoveOrder[];
}

/** W4: the valid moves grouped into armies, in the order their first unit was ordered. */
export function armiesOf(scenarioKey: (order: MoveOrder) => string, orders: readonly MoveOrder[]): readonly Army[] {
  const groups = new Map<string, MoveOrder[]>();
  for (const order of orders) {
    const key = scenarioKey(order);
    const group = groups.get(key) ?? [];
    group.push(order);
    groups.set(key, group);
  }
  return [...groups].map(([key, group]) => ({ key, orders: group }));
}

/**
 * Step 1, the `allowance` module's part (M1, M3, M5). Each order's legs were checked on their
 * own; here the moves are grouped into armies (W4) and checked as armies: the route must fit the
 * army's allowance, and its boarding capital, landing port or sea lane must have room. Armies
 * are served in the order their first unit was ordered. An army that cannot go stays where it
 * is, with its standing order; nothing is disbanded. The rest are sorted again into
 * reinforcements and advances (M11).
 */
export const checkArmies: Phase = (draft) => {
  const { scenario, start } = draft.input;
  const held: MoveHeldBackOutcome[] = [];
  const routes = new Map<UnitId, MoveRoute>();
  const departures = new Map<string, number>();
  const landings = new Map<string, number>();
  const lanes = new Map<string, number>();
  const heldUnits = new Set<UnitId>();
  for (const army of armiesOf((order) => armyKey(scenario, order), draft.orders.valid)) {
    const [first] = army.orders;
    if (first === undefined) continue;
    const unitIds = army.orders.map((order) => order.unitId);
    const transport = transportOf(scenario, start, unitIds);
    const check = describeRoute(scenario, start, first.factionId, first.from, legsOf(scenario, first), transport.allMobile);
    const reason = ((): HeldBackReason | undefined => {
      if (!check.ok) return "allowance";
      const { route } = check;
      if (!fitsAllowance(route.cost, route.steps, armyAllowance(scenario, start, first.factionId, first.from, unitIds))) return "allowance";
      const claims = routeClaims(route);
      if (claims.departure !== undefined && (departures.get(claims.departure) ?? 0) >= railDepartures(scenario, start, claims.departure)) return "rail-departures";
      const landingKey = claims.landing === undefined ? undefined : `${first.factionId}|${claims.landing}`;
      if (landingKey !== undefined && (landings.get(landingKey) ?? 0) >= portLandings(scenario, route.sea?.level ?? 0)) return "port-landings";
      const laneKey = claims.amphibious === undefined ? undefined : `${first.factionId}|${claims.amphibious}`;
      if (laneKey !== undefined && (lanes.get(laneKey) ?? 0) >= 1) return "amphibious-lane";
      if (claims.departure !== undefined) departures.set(claims.departure, (departures.get(claims.departure) ?? 0) + 1);
      if (landingKey !== undefined) landings.set(landingKey, (landings.get(landingKey) ?? 0) + 1);
      if (laneKey !== undefined) lanes.set(laneKey, (lanes.get(laneKey) ?? 0) + 1);
      return undefined;
    })();
    if (reason === undefined && check.ok) {
      for (const unitId of unitIds) routes.set(unitId, check.route);
    } else {
      for (const unitId of unitIds) heldUnits.add(unitId);
      held.push({ factionId: first.factionId, from: first.from, kind: "move-held-back", reason: reason ?? "allowance", to: first.to, unitIds });
    }
  }
  const valid = draft.orders.valid.filter((order) => !heldUnits.has(order.unitId));
  const { advances, reinforcements } = classifyMoves(start.control, draft.armies, valid);
  const origins = new Map([...draft.orders.origins].filter(([unitId]) => !heldUnits.has(unitId)));
  const submitted = new Map(valid.map((order) => [order.unitId, order]));
  return {
    ...draft,
    events: [...draft.events, ...held],
    orders: { ...draft.orders, advances, origins, reinforcements, valid },
    scratch: { ...draft.scratch, movement: { routes, submitted } }
  };
};

/**
 * Step 3, the `allowance` module's part (M2-M5, Q-UX-I3, T4).
 * - An army whose route stops in a territory (`transit`) that another faction's army is
 *   entering this turn stops at the first such territory and defends it as a reinforcement.
 *   Rail rides are checked at their ends, not at every territory the train passes.
 * - Every other move that is not a reinforcement goes to the territory its last leg starts
 *   from, and from there it is an ordinary one-step move for the meeting and territory battles
 *   (steps 4 and 5): a bounced army returns there.
 * - Reinforcements arrive (M11), as in the preset.
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
    if (route === undefined || route.legs.length === 1) continue;
    const key = armyKey(scenario, order);
    const stop = route.transit.find((territoryId) => [...(entering.get(territoryId) ?? [])].some((factionId) => factionId !== order.factionId));
    if (stop !== undefined) {
      const index = route.legs.findIndex((leg) => leg.to === stop);
      replaced.set(order.unitId, { ...order, legs: route.legs.slice(0, index + 1), to: stop });
      intercepted.add(order.unitId);
      const by = [...(entering.get(stop) ?? [])].filter((factionId) => factionId !== order.factionId).sort();
      const outcome = interceptions.get(key);
      interceptions.set(key, { byFactionIds: by, factionId: order.factionId, from: order.from, kind: "move-intercepted", stoppedAt: stop, to: order.to, unitIds: [...(outcome?.unitIds ?? []), order.unitId] });
      continue;
    }
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
