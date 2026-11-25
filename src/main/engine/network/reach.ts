import { hookedOrderVerdict } from "../hooks";
import { connectionBetween, enemyArmyIn, landNeighbors } from "../movement/network";
import { armyMovement, describeRoute, railFullRefusal, type RouteCheck, routeOffers } from "../movement/routes";
import type { FactionId, GameState, MoveLeg, MoveOrder, RailShortage, Refusal, Scenario, SubTerritoryId, TerritoryId, UnitId } from "../types";

/**
 * R5, U7: where a selection of units can go this turn, and how, or why not. Movement
 * validation, the AI, the Invade and Reinforce panes, the hover notes and the routed order lines
 * all read this one function. Owned by `network-engine`.
 */

/** R5: March (one territory, foot only across a link with no road), Motor (roads trucks may use, and trucks), Rail, Sea. */
export const moveModes = ["march", "motor", "rail", "sea"] as const;
export type MoveMode = (typeof moveModes)[number];

/** One step of a route: from one sub-territory to the next, across a link (or a sea lane for `sea`). */
export interface LinkStep {
  readonly from: SubTerritoryId;
  readonly mode: MoveMode;
  readonly to: SubTerritoryId;
}

/** Why a territory cannot be reached: the kinds of rule that stop a mode, for logic to compare. */
export const unreachableCodes = [
  "too-far",
  "no-road",
  "not-foot",
  "pass-blocks-motor",
  "contested",
  "enemy-ground",
  "no-rail",
  "rail-full",
  "no-trucks",
  "no-port",
  "sea-closed",
  "not-connected"
] as const;
export type UnreachableCode = (typeof unreachableCodes)[number];

export interface UnreachableReason {
  readonly code: UnreachableCode;
  /** The refusal itself, for the hover card to write out. */
  readonly refusal: Refusal;
}

export type Reach =
  | { readonly mode: MoveMode; readonly ok: true; readonly path: readonly LinkStep[] }
  | { readonly ok: false; readonly reasons: readonly UnreachableReason[] };

/** A key no sub-territory has, for a territory without a capital (it has no station to board at). */
const capitalless = "" as SubTerritoryId;

const priority: readonly UnreachableCode[] = ["pass-blocks-motor", "contested", "enemy-ground", "no-road", "not-foot", "no-port", "sea-closed", "no-rail", "too-far", "not-connected"];

/**
 * R5, U7: why the units cannot reach `to`, mode by mode: March, Motor, Rail and Sea, each with
 * the first rule that stops it. A module's refusal of every move from here (contested ground)
 * is the one reason when it applies.
 */
function unreachable(scenario: Scenario, state: GameState, factionId: FactionId, from: TerritoryId, unitIds: readonly [UnitId, ...UnitId[]], to: TerritoryId, full: RailShortage | undefined): readonly UnreachableReason[] {
  const verdict = hookedOrderVerdict({ order: { factionId, from, kind: "move", to, unitId: unitIds[0] }, scenario, state });
  if (verdict?.ok === false) return [{ code: "contested", refusal: verdict.refusal }];
  const reasons: UnreachableReason[] = [];
  const add = (code: UnreachableCode, refusal: Refusal): void => {
    reasons.push({ code, refusal });
  };
  if (unitIds.some((unitId) => state.units[unitId]?.morale.demoralized === true) && enemyArmyIn(state, factionId, to)) add("enemy-ground", { code: "demoralized-attack" });
  const movement = armyMovement(scenario, state, factionId, from, unitIds);
  const check = (legs: readonly MoveLeg[]): RouteCheck => describeRoute(scenario, state, factionId, from, legs, movement.allMobile, undefined, unitIds);
  const first = (checks: readonly RouteCheck[]): void => {
    const failures = checks.flatMap((each) => (each.ok ? [] : [each]));
    failures.sort((a, b) => priority.indexOf(a.code) - priority.indexOf(b.code));
    const [best] = failures;
    if (best !== undefined && failures.length === checks.length) add(best.code, best.refusal);
  };
  const neighbour = connectionBetween(scenario, from, to, "land") !== undefined;
  // March: one territory.
  if (neighbour) first([check([{ kind: "land", to }])]);
  else add("too-far", { code: "march-neighbours-only" });
  // Motor: two territories along roads trucks may use, with trucks.
  const vias = landNeighbors(scenario, from).filter((via) => connectionBetween(scenario, via, to, "land") !== undefined);
  const range = scenario.linkModifiers.road?.motorRange;
  if (!neighbour && vias.length === 0) {
    // A scenario without road rules sets no range, so there is none to name.
    if (range !== undefined) add("too-far", { code: "motor-too-far", territories: range });
  } else if (!neighbour && movement.allowance < 2) add("no-trucks", { code: "motor-needs-trucks" });
  else if (!neighbour) {
    first(vias.map((via) => check([{ kind: "land", to: via }, { kind: "land", to }])));
  }
  // Rail: a ride from the capital, or a ride and then a step. D5: a train that could take the units has too few places left.
  // Only where the army could board at all: its territory's capital is its side's, with an open station.
  const station = state.subTerritories[scenario.index.territories.get(from)?.capitalSubTerritoryId ?? capitalless];
  if (full !== undefined) add("rail-full", railFullRefusal(full));
  else if (scenario.linkModifiers.rail !== undefined && station?.holder === factionId && station.rail > 0) add("no-rail", { code: "no-rail-line" });
  // Sea: as today.
  if (connectionBetween(scenario, from, to, "sea") !== undefined) first([check([{ kind: "sea", to }])]);
  return reasons.length > 0 ? reasons : [{ code: "not-connected", refusal: { code: "out-of-reach" } }];
}

/**
 * Every territory but the units' own, with how the units reach it together, or why they cannot.
 * The units must share a territory and a faction; otherwise the map is empty. A reachable
 * territory gets the one route the game offers (`moveRoutes`: March or Sea first, then Rail,
 * then Motor), its mode and the links it crosses; movement validation, the computer player and
 * the screens read the same routes, so they agree. `planned` is the faction's other orders this
 * turn, which use the trains', ports' and lanes' room.
 */
export function reachFor(scenario: Scenario, state: GameState, factionId: FactionId, unitIds: readonly UnitId[], planned: readonly MoveOrder[] = []): ReadonlyMap<TerritoryId, Reach> {
  const units = unitIds.map((unitId) => state.units[unitId]);
  const from = units[0]?.territoryId;
  const [probe, ...rest] = unitIds;
  if (from === undefined || probe === undefined || units.some((unit) => unit === undefined || unit.factionId !== factionId || unit.territoryId !== from)) return new Map();
  const { full, routes } = routeOffers(scenario, state, factionId, from, unitIds, planned);
  const reach = new Map<TerritoryId, Reach>();
  for (const territory of scenario.territories) {
    if (territory.id === from) continue;
    const route = routes.get(territory.id);
    reach.set(territory.id, route === undefined
      ? { ok: false, reasons: unreachable(scenario, state, factionId, from, [probe, ...rest], territory.id, full.get(territory.id)) }
      : { mode: route.mode, ok: true, path: route.path });
  }
  return reach;
}
