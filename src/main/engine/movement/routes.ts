import { hookedOrderVerdict } from "../hooks";
import { isNeighbor, neighborsOf } from "../lookup";
import { hasLinks } from "../network/links";
import { allFoot, marchCrossing, motorPath, startSubTerritories } from "../network/paths";
import type { LinkStep, MoveMode, UnreachableCode } from "../network/reach";
import { isContested } from "../partition/holders";
import type { FactionId, GameState, MoveLeg, MovementRefusal, MoveOrder, RailShortage, Scenario, SubTerritoryId, TerritoryId, UnitId } from "../types";
import { hasFighter } from "../units/fighting";
import { armyAllowance, fitsAllowance, transportOf } from "./allowance";
import {
  connectionBetween,
  connectionKey,
  departurePort,
  enemyArmyIn,
  entrySubTerritory,
  isFriendlyGround,
  landingAt,
  landNeighbors,
  portLandings,
  railCapacity,
  railPlaces,
  railReach,
  type RailRide,
  seaClosed,
  seaEndPort,
  subTerritoriesOf
} from "./network";

/**
 * M2-M5: the shapes a move may take, and the one route the game offers for each destination.
 * The reveal check, the planning screen and the computer player all read moves through this
 * file, so they agree on every leg.
 *
 * - `step`: one land step, anywhere (it may attack): R5's March, across a link with a road or,
 *   for foot units, any link.
 * - `march`: two or more land steps within the allowance (M1): R5's Motor, along roads trucks may use,
 *   never over a pass or into contested ground, at most the road rules' `motorRange`, with no
 *   rough-ground cost on the roads; every step but the last ends in friendly ground (M2).
 * - `rail`: a ride from the territory's capital to another capital in friendly ground (M3).
 * - `step-rail`: one step into friendly ground, then a ride from its capital (M4).
 * - `rail-step`: a ride, then one step that may attack (M4).
 * - `sea`: one sea leg from the lane's port at the origin end, which the faction holds, landing
 *   in the lane's port at the other end when the faction holds it, else assaulting it (M5,
 *   Q-CITY-7: each sea connection's `entry` pair names its ports).
 */
export const routeShapes = ["step", "sea", "rail", "march", "step-rail", "rail-step"] as const;
export type RouteShape = (typeof routeShapes)[number];

/** M5: how a sea leg lands. */
export interface SeaLanding {
  /** The friendly port the army sails from. */
  readonly departure: SubTerritoryId;
  readonly kind: "port" | "amphibious";
  /** The landing port and its level, for a port landing. */
  readonly level?: number;
  readonly port?: SubTerritoryId;
}

/** One way to move, with everything the rules and the screens need to know about it. */
export interface MoveRoute {
  /** Allowance the steps use (M1): 1 a step, plus 1 for each mountain or swamp entry. */
  readonly cost: number;
  readonly from: TerritoryId;
  readonly legs: readonly MoveLeg[];
  /** R5: how the army moves: March (one land step), Motor (a road march), Rail (any route with a ride) or Sea. */
  readonly mode: MoveMode;
  /**
   * R5: the links the route crosses, sub-territory to sub-territory, in order. A sea leg is one
   * step from port to landing. Empty in a scenario without links.
   */
  readonly path: readonly LinkStep[];
  /** The ride, when the route uses rail. */
  readonly rail?: RailRide;
  /** Mountain or swamp sub-territories the steps enter (P8), in order. */
  readonly rough: readonly SubTerritoryId[];
  /** The landing, when the route crosses the sea. */
  readonly sea?: SeaLanding;
  readonly shape: RouteShape;
  /** Where the last leg starts. */
  readonly staging: TerritoryId;
  /** Land and sea steps; rail legs are not steps (M1). */
  readonly steps: number;
  readonly to: TerritoryId;
  /** M2: territories the route passes before its destination (leg ends and the territories a train runs through), where an enemy arrival stops it. */
  readonly transit: readonly TerritoryId[];
}

export type RouteCheck = { readonly ok: true; readonly route: MoveRoute } | { readonly code: UnreachableCode; readonly ok: false; readonly refusal: MovementRefusal };

function refuse(code: UnreachableCode, refusal: MovementRefusal): RouteCheck {
  return { code, ok: false, refusal };
}

/** R5: the move mode a route shape is. */
export function modeOf(shape: RouteShape): MoveMode {
  switch (shape) {
    case "step":
      return "march";
    case "march":
      return "motor";
    case "sea":
      return "sea";
    case "rail":
    case "step-rail":
    case "rail-step":
      return "rail";
  }
}

/** M1, P8: the sub-territory is mountain or swamp, which costs a step one more. */
function isRough(scenario: Scenario, subTerritoryId: SubTerritoryId): boolean {
  const terrain = scenario.index.subTerritories.get(subTerritoryId)?.terrain;
  return terrain === "mountain" || terrain === "swamp";
}

/** CT-6: the legs of an order; absent means one step along the connection (land first). */
export function legsOf(scenario: Scenario, order: Pick<MoveOrder, "from" | "legs" | "to">): readonly MoveLeg[] {
  if (order.legs !== undefined && order.legs.length > 0) return order.legs;
  const kind = connectionBetween(scenario, order.from, order.to, "land") === undefined && connectionBetween(scenario, order.from, order.to, "sea") !== undefined ? "sea" : "land";
  return [{ kind, to: order.to }];
}

/** W4: an army is every unit of one faction leaving one territory along the same legs. */
export function armyKey(scenario: Scenario, order: Pick<MoveOrder, "factionId" | "from" | "legs" | "to">): string {
  return `${order.factionId}|${order.from}|${legsOf(scenario, order).map((leg) => `${leg.kind}:${leg.to}`).join(">")}`;
}

function shapeOf(legs: readonly MoveLeg[]): RouteShape | undefined {
  const kinds = legs.map((leg) => leg.kind).join(",");
  if (kinds === "land") return "step";
  if (kinds === "sea") return "sea";
  if (kinds === "rail") return "rail";
  if (kinds === "land,rail") return "step-rail";
  if (kinds === "rail,land") return "rail-step";
  if (legs.length > 1 && legs.every((leg) => leg.kind === "land")) return "march";
  return undefined;
}

type Rides = (from: TerritoryId) => ReadonlyMap<TerritoryId, RailRide>;

function ridesFor(scenario: Scenario, state: GameState, factionId: FactionId): Rides {
  const cache = new Map<TerritoryId, ReadonlyMap<TerritoryId, RailRide>>();
  return (from) => {
    let rides = cache.get(from);
    if (rides === undefined) {
      rides = railReach(scenario, state, factionId, from);
      cache.set(from, rides);
    }
    return rides;
  };
}

/**
 * M2-M5, R5: whether the legs make a legal route from `from` for the faction, and what it is,
 * with the links it crosses. The allowance (M1) and the per-turn capacities are the army's and
 * are checked by the caller; the cost here assumes the army is `allMobile` or not. `unitIds`
 * are the units that move: March reads whether they are all foot units, and every land route
 * leaves from their pocket (R1). Without them, the army is taken to be foot and to stand in all
 * its side's ground there.
 */
export function describeRoute(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  from: TerritoryId,
  legs: readonly MoveLeg[],
  allMobile = false,
  rides: Rides = ridesFor(scenario, state, factionId),
  unitIds?: readonly UnitId[]
): RouteCheck {
  const shape = shapeOf(legs);
  const last = legs[legs.length - 1];
  if (shape === undefined || last === undefined) return refuse("not-connected", { code: "route-shape" });
  const linked = hasLinks(scenario);
  const foot = allFoot(scenario, state, unitIds);
  const start = linked ? startSubTerritories(scenario, state, factionId, from, unitIds) : [];
  const roads = scenario.linkModifiers.road;
  if (shape === "march" && linked && roads !== undefined && legs.length > roads.motorRange) return refuse("too-far", { code: "motor-too-far", territories: roads.motorRange });
  let at = from;
  let subs = start;
  let cost = 0;
  let steps = 0;
  let rail: RailRide | undefined;
  let sea: SeaLanding | undefined;
  const path: LinkStep[] = [];
  const rough: SubTerritoryId[] = [];
  const transit: TerritoryId[] = [];
  const visited = new Set<TerritoryId>([from]);
  const enter = (entry: SubTerritoryId | undefined): void => {
    cost += 1;
    steps += 1;
    if (entry === undefined || !isRough(scenario, entry)) return;
    rough.push(entry);
    if (!allMobile) cost += 1;
  };
  for (const [index, leg] of legs.entries()) {
    const final = index === legs.length - 1;
    if (visited.has(leg.to)) return refuse("not-connected", { code: "route-repeats-territory" });
    if (leg.kind === "rail") {
      const ride = rides(at).get(leg.to);
      if (ride === undefined) return refuse("no-rail", { code: "no-rail-to-capital" });
      rail = ride;
      for (const [stop, station] of ride.stations.slice(1).entries()) path.push({ from: ride.stations[stop] as SubTerritoryId, mode: "rail", to: station });
      // M2, Q-MR-16: the territories the train passes are on the way too; an enemy entering one stops it there.
      for (const passed of ride.through) {
        if (visited.has(passed)) return refuse("not-connected", { code: "route-repeats-territory" });
        visited.add(passed);
        transit.push(passed);
      }
    } else if (leg.kind === "land") {
      if (connectionBetween(scenario, at, leg.to, "land") === undefined) return refuse("not-connected", { code: "not-connected" });
      if (linked && shape === "march") {
        // R5: Motor's links are found for the whole route below; count the step here.
        cost += 1;
        steps += 1;
      } else if (linked) {
        const crossing = marchCrossing(scenario, state, subs, leg.to, foot);
        if (!crossing.ok) return crossing;
        path.push(crossing.step);
        enter(crossing.step.to);
      } else {
        enter(entrySubTerritory(scenario, at, leg.to, "land"));
      }
    } else {
      if (connectionBetween(scenario, at, leg.to, "sea") === undefined) return refuse("not-connected", { code: "no-sea-lane" });
      const departure = departurePort(scenario, state, factionId, at, leg.to);
      if (departure === undefined) return refuse("no-port", { code: "lane-port-not-held" });
      if (seaClosed(scenario, state, at, leg.to)) return refuse("sea-closed", { code: "sea-closed" });
      const landing = landingAt(scenario, state, factionId, at, leg.to);
      sea = landing.kind === "port"
        ? { departure: departure.subTerritoryId, kind: "port", level: landing.level, port: landing.subTerritoryId }
        : { departure: departure.subTerritoryId, kind: "amphibious" };
      const ashore = landing.kind === "port" ? landing.subTerritoryId : (seaEndPort(scenario, at, leg.to, leg.to) ?? subTerritoriesOf(scenario, leg.to)[0]);
      if (ashore !== undefined) path.push({ from: departure.subTerritoryId, mode: "sea", to: ashore });
      cost += 1;
      steps += 1;
    }
    if (!final) {
      // M2: only the last leg may enter enemy or contested ground.
      if (!isFriendlyGround(scenario, state, factionId, leg.to)) return refuse("enemy-ground", { code: "enemy-ground-on-the-way" });
      transit.push(leg.to);
    }
    visited.add(leg.to);
    at = leg.to;
    // A later leg leaves from ground held whole (M2: a ride ends and every leg but the last stops
    // only in friendly ground), so the army's pocket there is the whole territory.
    subs = linked ? subTerritoriesOf(scenario, leg.to) : [];
  }
  if (shape === "march" && linked) {
    // R5: Motor never enters contested ground, and runs along roads trucks may use the whole way.
    if (isContested(scenario, state, last.to)) return refuse("contested", { code: "motor-contested-ground" });
    // Declog D13: a road crosses mountain and swamp, so Motor pays no rough-ground step (P8).
    const motor = motorPath(scenario, state, start, legs.map((leg) => leg.to));
    if (!motor.ok) return motor;
    path.push(...motor.path.map(({ step }) => step));
  }
  const staging = legs.length > 1 ? (legs[legs.length - 2]?.to ?? from) : from;
  return {
    ok: true,
    route: {
      cost,
      from,
      legs,
      mode: modeOf(shape),
      path,
      ...(rail === undefined ? {} : { rail }),
      rough,
      ...(sea === undefined ? {} : { sea }),
      shape,
      staging,
      steps,
      to: last.to,
      transit
    }
  };
}

/** What the faction's planned moves already use this turn (M3, M5): train places by unit (D5), the rest by army. */
export interface RouteUsage {
  readonly amphibious: ReadonlyMap<string, ReadonlySet<string>>;
  /** D5: train places taken at each boarding capital. */
  readonly departures: ReadonlyMap<SubTerritoryId, number>;
  /** Port landings by landing port. */
  readonly landings: ReadonlyMap<SubTerritoryId, ReadonlySet<string>>;
}

function addTo<Key>(map: Map<Key, Set<string>>, key: Key, army: string): void {
  const set = map.get(key) ?? new Set<string>();
  set.add(army);
  map.set(key, set);
}

/** The capacity each route takes: train places at its boarding capital, a landing in a port, or an amphibious lane. */
export function routeClaims(route: MoveRoute): { readonly amphibious?: string; readonly departure?: SubTerritoryId; readonly landing?: SubTerritoryId } {
  return {
    ...(route.rail === undefined ? {} : { departure: route.rail.boarding }),
    ...(route.sea?.kind === "port" && route.sea.port !== undefined ? { landing: route.sea.port } : {}),
    ...(route.sea?.kind === "amphibious" ? { amphibious: connectionKey(route.staging, route.to) } : {})
  };
}

/** Units taking a route together: their army (W4) and the train places they need (`railPlaces`, D5). */
export interface RouteParty {
  readonly army: string;
  readonly places: number;
  readonly route: MoveRoute;
}

/** M3, M5, D5: the capacity a set of planned routes uses: a train place per unit, and one landing or lane per army. */
export function usageOf(routes: readonly RouteParty[]): RouteUsage {
  const amphibious = new Map<string, Set<string>>();
  const departures = new Map<SubTerritoryId, number>();
  const landings = new Map<SubTerritoryId, Set<string>>();
  for (const { army, places, route } of routes) {
    const claims = routeClaims(route);
    if (claims.departure !== undefined) departures.set(claims.departure, (departures.get(claims.departure) ?? 0) + places);
    if (claims.landing !== undefined) addTo(landings, claims.landing, army);
    if (claims.amphibious !== undefined) addTo(amphibious, claims.amphibious, army);
  }
  return { amphibious, departures, landings };
}

/** D5: the places still free on the trains at a boarding capital, given what is used. */
export function railPlacesLeft(scenario: Scenario, state: GameState, boarding: SubTerritoryId, usage: Pick<RouteUsage, "departures">): number {
  return Math.max(0, railCapacity(scenario, state, boarding) - (usage.departures.get(boarding) ?? 0));
}

/** D5: units that need `places` on the trains at `boarding` board whole or not at all: how few are left, when they don't fit. */
function shortageAt(scenario: Scenario, state: GameState, boarding: SubTerritoryId, places: number, usage: Pick<RouteUsage, "departures">): RailShortage | undefined {
  const left = railPlacesLeft(scenario, state, boarding, usage);
  return places > left ? { boarding, left, places } : undefined;
}

/** D5: why the route's trains can't take the party whole, or undefined when they can or it takes none. */
export function railShortage(scenario: Scenario, state: GameState, { places, route }: Pick<RouteParty, "places" | "route">, usage: Pick<RouteUsage, "departures">): RailShortage | undefined {
  const { departure } = routeClaims(route);
  return departure === undefined ? undefined : shortageAt(scenario, state, departure, places, usage);
}

/** D5: the refusal of an army its trains can't take whole. */
export function railFullRefusal(shortage: RailShortage): MovementRefusal {
  return { code: "rail-full", ...shortage };
}

/** M3, M5, D5: room left on the route for the party, given what is used (a landing or lane its army already has is free). */
export function hasRoom(scenario: Scenario, state: GameState, party: RouteParty, usage: RouteUsage): boolean {
  const { army, route } = party;
  if (railShortage(scenario, state, party, usage) !== undefined) return false;
  const claims = routeClaims(route);
  if (claims.landing !== undefined) {
    const used = usage.landings.get(claims.landing);
    if (!(used?.has(army) ?? false) && (used?.size ?? 0) >= portLandings(scenario, route.sea?.level ?? 0)) return false;
  }
  if (claims.amphibious !== undefined) {
    const used = usage.amphibious.get(claims.amphibious);
    if (!(used?.has(army) ?? false) && (used?.size ?? 0) >= 1) return false;
  }
  return true;
}

/** The planned moves of a faction as routes, for `usageOf`. Orders whose legs no longer describe a route are left out. */
export function plannedRoutes(scenario: Scenario, state: GameState, orders: readonly MoveOrder[]): readonly RouteParty[] {
  return orders.flatMap((order) => {
    const check = describeRoute(scenario, state, order.factionId, order.from, legsOf(scenario, order), true, undefined, [order.unitId]);
    return check.ok ? [{ army: armyKey(scenario, order), places: railPlaces(scenario, state, [order.unitId]), route: check.route }] : [];
  });
}

/**
 * D5: why moves about to be given can't all board, given the faction's other planned moves: the
 * first boarding capital with too few places left for the units that would board there together.
 */
export function boardingRefusal(scenario: Scenario, state: GameState, moves: readonly MoveOrder[], others: readonly MoveOrder[]): MovementRefusal | undefined {
  const { departures } = usageOf(plannedRoutes(scenario, state, moves));
  if (departures.size === 0) return undefined;
  const usage = usageOf(plannedRoutes(scenario, state, others));
  for (const [boarding, places] of departures) {
    const shortage = shortageAt(scenario, state, boarding, places, usage);
    if (shortage !== undefined) return railFullRefusal(shortage);
  }
  return undefined;
}

/** The selected army's allowance and transport, as the planning screen summarizes them (X5). */
export interface ArmyMovement {
  readonly allMobile: boolean;
  readonly allowance: number;
  /** Units the army's transport can carry. */
  readonly capacity: number;
  readonly needing: number;
  readonly transports: number;
}

export function armyMovement(scenario: Scenario, state: GameState, factionId: FactionId, from: TerritoryId, unitIds: readonly UnitId[]): ArmyMovement {
  const transport = transportOf(scenario, state, unitIds);
  return { allMobile: transport.allMobile, allowance: armyAllowance(scenario, state, factionId, from, unitIds), capacity: transport.capacity, needing: transport.needing, transports: transport.transports };
}

/**
 * M1-M5: every destination the given units can reach together this turn, each with the one
 * route the game offers: a single step or a sea leg first, then a pure ride, a march, a step and
 * a ride, and a ride and a step. Within a shape the first found wins, in scenario order. Routes
 * with no capacity left, given the faction's other planned moves, are skipped, so the next
 * shape is offered instead.
 */
export function moveRoutes(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  from: TerritoryId,
  unitIds: readonly UnitId[],
  planned: readonly MoveOrder[] = []
): ReadonlyMap<TerritoryId, MoveRoute> {
  return routeOffers(scenario, state, factionId, from, unitIds, planned).routes;
}

/** What the game offers units setting out together: `moveRoutes`, and the destinations only full trains keep them from. */
export interface RouteOffers {
  /** D5: the destinations with no route because their trains can't take the units whole, with the places left. */
  readonly full: ReadonlyMap<TerritoryId, RailShortage>;
  readonly routes: ReadonlyMap<TerritoryId, MoveRoute>;
}

/** `moveRoutes`, with the refusals the trains' places give (D5). */
export function routeOffers(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  from: TerritoryId,
  unitIds: readonly UnitId[],
  planned: readonly MoveOrder[]
): RouteOffers {
  const movement = armyMovement(scenario, state, factionId, from, unitIds);
  const rides = ridesFor(scenario, state, factionId);
  const ordered = new Set(unitIds);
  const usage = usageOf(plannedRoutes(scenario, state, planned.filter((order) => order.factionId === factionId && !ordered.has(order.unitId))));
  const places = railPlaces(scenario, state, unitIds);
  const found = new Map<TerritoryId, MoveRoute>();
  const full = new Map<TerritoryId, RailShortage>();
  // M23: a demoralized unit cannot attack, so it may not enter where another faction stands.
  const demoralized = unitIds.some((unitId) => state.units[unitId]?.morale.demoralized === true);
  // D27.1: units that cannot fight only reinforce their own side (M11), as step 1 holds them back otherwise.
  const fighterless = unitIds.length > 0 && !hasFighter(scenario, state.raised, unitIds);
  const offer = (legs: readonly MoveLeg[]): void => {
    const to = legs[legs.length - 1]?.to;
    if (to === undefined || to === from || found.has(to)) return;
    if (demoralized && enemyArmyIn(state, factionId, to)) return;
    if (fighterless && !reinforces(state, factionId, to, ordered)) return;
    // C1: a module may refuse the move outright (no move leaves contested ground, `orderVerdict`).
    const [probe] = unitIds;
    if (probe !== undefined && hookedOrderVerdict({ order: { factionId, from, kind: "move", legs, to, unitId: probe }, scenario, state })?.ok === false) return;
    const check = describeRoute(scenario, state, factionId, from, legs, movement.allMobile, rides, unitIds);
    if (!check.ok || !fitsAllowance(check.route.cost, check.route.steps, movement.allowance)) return;
    const party: RouteParty = { army: armyKey(scenario, { factionId, from, legs, to }), places, route: check.route };
    if (hasRoom(scenario, state, party, usage)) {
      found.set(to, check.route);
      return;
    }
    const shortage = railShortage(scenario, state, party, usage);
    // The first ride tried is the one to name, as it is the one the game would have offered.
    if (shortage !== undefined && !full.has(to)) full.set(to, shortage);
  };

  for (const neighbor of neighborsOf(scenario, from)) offer([{ kind: neighbor.kind, to: neighbor.territoryId }]);
  for (const end of rides(from).keys()) offer([{ kind: "rail", to: end }]);
  if (movement.allowance >= 2) for (const legs of marches(scenario, state, factionId, from, movement.allowance)) offer(legs);
  for (const via of landNeighbors(scenario, from)) {
    if (!isFriendlyGround(scenario, state, factionId, via)) continue;
    for (const end of rides(via).keys()) offer([{ kind: "land", to: via }, { kind: "rail", to: end }]);
  }
  for (const end of rides(from).keys()) {
    for (const next of landNeighbors(scenario, end)) offer([{ kind: "rail", to: end }, { kind: "land", to: next }]);
  }
  return { full: new Map([...full].filter(([to]) => !found.has(to))), routes: found };
}

/** M11: a move into ground the faction controls, or where its units that are not moving stand, is a reinforcement. */
function reinforces(state: GameState, factionId: FactionId, to: TerritoryId, moving: ReadonlySet<UnitId>): boolean {
  const control = state.control[to];
  return (control?.kind === "controlled" && control.factionId === factionId)
    || Object.values(state.units).some((unit) => unit.territoryId === to && unit.factionId === factionId && !moving.has(unit.id));
}

/** M1, M2: land paths of 2 up to `allowance` steps through friendly ground, shortest first, in scenario order. */
function marches(scenario: Scenario, state: GameState, factionId: FactionId, from: TerritoryId, allowance: number): readonly (readonly MoveLeg[])[] {
  const paths: MoveLeg[][] = [];
  let frontier: { readonly at: TerritoryId; readonly legs: readonly MoveLeg[] }[] = [{ at: from, legs: [] }];
  for (let depth = 1; depth <= allowance; depth += 1) {
    const next: { readonly at: TerritoryId; readonly legs: readonly MoveLeg[] }[] = [];
    for (const { at, legs } of frontier) {
      if (legs.length > 0 && !isFriendlyGround(scenario, state, factionId, at)) continue;
      for (const neighbor of landNeighbors(scenario, at)) {
        if (neighbor === from || legs.some((leg) => leg.to === neighbor)) continue;
        const extended = [...legs, { kind: "land" as const, to: neighbor }];
        if (depth >= 2) paths.push(extended);
        next.push({ at: neighbor, legs: extended });
      }
    }
    frontier = next;
  }
  return paths;
}

/** M1-M5: the per-order check of a move's legs against the start-of-turn state, under the `allowance` module. */
export function validateRoute(scenario: Scenario, state: GameState, order: MoveOrder): RouteCheck {
  const legs = legsOf(scenario, order);
  if (legs[legs.length - 1]?.to !== order.to) return refuse("not-connected", { code: "route-ends-elsewhere" });
  if (legs.length === 1 && legs[0]?.kind !== "rail" && !isNeighbor(scenario, order.from, order.to)) {
    return refuse("not-connected", { code: "not-connected" });
  }
  return describeRoute(scenario, state, order.factionId, order.from, legs, true, undefined, [order.unitId]);
}
