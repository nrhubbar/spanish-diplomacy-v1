import { orderLine } from "../engine/network/lines";
import type { BattleOutcome, BattleResult, FactionId, GameState, MoveLeg, MoveOrder, Scenario, SubTerritoryId, TerritoryId, TurnOutcome, UnitId } from "../engine/types";
import { affectedFaction } from "../presentation/battle";
import { battleTitle, isBattle, resultKeyOf } from "../presentation/grades";
import type { MapPoint } from "../scenarios/loader";

export type RouteKind = "planned" | "moved" | "bounced" | "disbanded" | "battle";

/** A battle fought at the end of a route: its result and the faction the result fell on. */
export interface RouteBattle {
  readonly affectedFactionId: FactionId;
  /** The result key its medallion draws: its grade's family. */
  readonly result: BattleResult;
  /** D8: the result as players read it, named on hover: the grade's name. */
  readonly title: string;
}

export interface RouteGroup {
  /** Set on routes that ended in a battle; the route shows the battle's medallion. */
  readonly battle?: RouteBattle;
  readonly count: number;
  readonly factionId: FactionId;
  readonly from: TerritoryId;
  readonly key: string;
  readonly kind: RouteKind;
  /** 0 for the first route between this origin and destination; later ones run further out. */
  readonly lane: number;
  /** U8: the sub-territories along the links the move uses (`orderLine`); empty when unknown, which draws it straight. */
  readonly line: readonly SubTerritoryId[];
  readonly to: TerritoryId;
}

interface RouteEntry {
  readonly battle?: RouteBattle;
  readonly factionId: FactionId;
  readonly from: TerritoryId;
  readonly kind: RouteKind;
  readonly legs?: readonly MoveLeg[];
  readonly to: TerritoryId;
  readonly unitId: UnitId;
}

/**
 * The moves that ended in a battle: attackers (and, on the road or into an empty territory,
 * the other side too) from where they set out to where they fought. Standing battles (M27)
 * moved nobody, so they draw no route.
 */
export function battleRoutes(battle: BattleOutcome, scenario?: Scenario): readonly RouteEntry[] {
  const mark = routeBattle(battle, scenario);
  const { site } = battle;
  const armies = site.kind === "assault" ? battle.attacker.armies : [...battle.attacker.armies, ...battle.defender.armies];
  return armies.flatMap((army) => {
    const to = site.kind === "meeting" ? site.between.find((id) => id !== army.from) : site.territoryId;
    return to === undefined || to === army.from ? [] : [{ battle: mark, factionId: army.factionId, from: army.from, kind: "battle", to, unitId: army.unitId }];
  });
}

/** A battle's mark: its result key and title. Without the scenario, a battle is named by its grade id. */
export function routeBattle(battle: BattleOutcome, scenario?: Scenario): RouteBattle {
  const affectedFactionId = affectedFaction(battle);
  return scenario === undefined
    ? { affectedFactionId, result: "both-demoralized", title: battle.grade }
    : { affectedFactionId, result: resultKeyOf(scenario, battle), title: battleTitle(scenario, battle) };
}

/** Lines already worked out, per start-of-turn state, so panning the map never re-checks a route. */
const lineCache = new WeakMap<GameState, Map<string, readonly SubTerritoryId[]>>();

/** U8: the links a move uses, read from the start-of-turn `state` (`orderLine`), cached per state. */
export function routeLine(scenario: Scenario, state: GameState, entry: Pick<RouteEntry, "factionId" | "from" | "legs" | "to" | "unitId">): readonly SubTerritoryId[] {
  let lines = lineCache.get(state);
  if (lines === undefined) {
    lines = new Map();
    lineCache.set(state, lines);
  }
  const key = `${scenario.id}|${entry.factionId}|${entry.unitId}|${entry.from}|${(entry.legs ?? []).map((leg) => `${leg.kind}:${leg.to}`).join(">")}|${entry.to}`;
  let line = lines.get(key);
  if (line === undefined) {
    const traced = orderLine(scenario, state, { ...entry, ...(entry.legs === undefined ? {} : { legs: entry.legs }) });
    // On a later board (the turn report) a route may be traced from elsewhere: keep only a line from `from` to `to`.
    const territoryOf = (id: SubTerritoryId | undefined) => (id === undefined ? undefined : scenario.index.subTerritories.get(id)?.territoryId);
    line = territoryOf(traced[0]) === entry.from && territoryOf(traced[traced.length - 1]) === entry.to ? traced : [];
    lines.set(key, line);
  }
  return line;
}

/**
 * V10: one route per (origin, destination, faction, result, links), with a count instead of
 * duplicates. Routes of different factions or results along the same origin and destination get
 * their own lane. U8: with the scenario and the start-of-turn state, each route carries the links
 * it follows.
 */
export function groupRoutes(planned: readonly MoveOrder[], outcomes: readonly TurnOutcome[], scenario?: Scenario, state?: GameState): readonly RouteGroup[] {
  const fromOrder = (kind: RouteKind, order: MoveOrder): RouteEntry => ({ factionId: order.factionId, from: order.from, kind, ...(order.legs === undefined ? {} : { legs: order.legs }), to: order.to, unitId: order.unitId });
  // A battle's armies carry no legs; the move each made does, so its line can follow them.
  const legsOf = new Map(outcomes.flatMap((outcome) => ("order" in outcome && outcome.order.kind === "move" && outcome.order.legs !== undefined ? [[`${outcome.order.unitId}:${outcome.order.from}`, outcome.order.legs] as const] : [])));
  const fought = outcomes.flatMap((outcome) => (isBattle(outcome) ? battleRoutes(outcome, scenario) : [])).map((entry) => {
    const legs = legsOf.get(`${entry.unitId}:${entry.from}`);
    return legs === undefined || legs[legs.length - 1]?.to !== entry.to ? entry : { ...entry, legs };
  });
  // A move that ended in a battle shows the battle, not a bounce or loss icon.
  const inBattle = new Set(fought.map((entry) => `${entry.unitId}:${entry.from}:${entry.to}`));
  const fromOutcome = (outcome: TurnOutcome): readonly RouteEntry[] => {
    switch (outcome.kind) {
      case "successful-move":
      case "reinforcement-arrived":
        return [fromOrder("moved", outcome.order)];
      case "bounced-move":
        return [fromOrder("bounced", outcome.order)];
      case "disbanded-move":
        return [fromOrder("disbanded", outcome.order)];
      default:
        return [];
    }
  };
  const entries: readonly RouteEntry[] = [
    ...planned.map((order) => fromOrder("planned", order)),
    ...outcomes.flatMap(fromOutcome).filter((entry) => !inBattle.has(`${entry.unitId}:${entry.from}:${entry.to}`)),
    ...fought
  ];
  const groups = new Map<string, RouteGroup>();
  const lanes = new Map<string, number>();
  for (const entry of entries) {
    const { battle, factionId, from, kind, to } = entry;
    const line = scenario === undefined || state === undefined ? [] : routeLine(scenario, state, entry);
    const key = `${kind}:${battle?.title ?? ""}:${factionId}:${from}:${to}:${line.join(">")}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      const pair = `${from}:${to}`;
      const lane = lanes.get(pair) ?? 0;
      lanes.set(pair, lane + 1);
      groups.set(key, { ...(battle === undefined ? {} : { battle }), count: 1, factionId, from, key, kind, lane, line, to });
    } else {
      groups.set(key, { ...existing, count: existing.count + 1 });
    }
  }
  return [...groups.values()];
}

export interface RouteCurve {
  readonly control: MapPoint;
  readonly end: MapPoint;
  readonly start: MapPoint;
}

/** A gentle quadratic arc for the sea lanes; order lines follow the links instead (U8). */
export function routeCurve(from: MapPoint, to: MapPoint, bend = 0.18): RouteCurve {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return {
    control: { x: (from.x + to.x) / 2 - dy * bend, y: (from.y + to.y) / 2 + dx * bend },
    end: to,
    start: from
  };
}

/** Where a route's points sit on the map: territory anchors, and sub-territory capitals when the map has them. */
export interface RoutePoints {
  readonly anchor: (id: TerritoryId) => MapPoint;
  readonly subPoint?: (id: SubTerritoryId) => MapPoint | undefined;
}

/**
 * U8: the points a route is drawn through: the capitals of the sub-territories along the links it
 * uses, or, without a line (a scenario without links, a move the start-of-turn state no longer
 * describes), straight from anchor to anchor. Never a curve.
 */
export function routePoints(route: Pick<RouteGroup, "from" | "line" | "to">, points: RoutePoints): readonly MapPoint[] {
  const along = route.line.map((id) => points.subPoint?.(id));
  const placed = along.filter((point) => point !== undefined);
  if (route.line.length >= 2 && placed.length === along.length) return placed;
  return [points.anchor(route.from), points.anchor(route.to)];
}

/** A polyline's segments, in order. */
function segmentsOf(points: readonly MapPoint[]): readonly (readonly [MapPoint, MapPoint])[] {
  return points.slice(1).map((point, index) => [points[index] ?? point, point] as const);
}

/** Total length of a polyline, in map units. */
export function polylineLength(points: readonly MapPoint[]): number {
  return segmentsOf(points).reduce((sum, [a, b]) => sum + distance(a, b), 0);
}

/** The point `share` (0 to 1) of the way along a polyline. */
export function pointAlong(points: readonly MapPoint[], share: number): MapPoint {
  let left = Math.max(0, Math.min(1, share)) * polylineLength(points);
  for (const [a, b] of segmentsOf(points)) {
    const length = distance(a, b);
    if (length > 0 && left <= length) return { x: a.x + ((b.x - a.x) * left) / length, y: a.y + ((b.y - a.y) * left) / length };
    left -= length;
  }
  return points[points.length - 1] ?? { x: 0, y: 0 };
}

/**
 * Cuts `startTrim` and `endTrim` map units off a polyline's ends, so it starts clear of the
 * origin's counters and its head lands short of the anchor. A short line keeps its middle fifth.
 */
export function trimPolyline(points: readonly MapPoint[], startTrim: number, endTrim: number): readonly MapPoint[] {
  const length = polylineLength(points);
  if (length === 0) return points;
  const from = Math.min(0.4, startTrim / length);
  const to = Math.max(0.6, 1 - endTrim / length);
  const kept: MapPoint[] = [pointAlong(points, from)];
  let walked = 0;
  for (const [a, b] of segmentsOf(points)) {
    walked += distance(a, b);
    const share = walked / length;
    if (share > from && share < to) kept.push(b);
  }
  kept.push(pointAlong(points, to));
  return kept;
}

/**
 * Moves a polyline `offset` map units to its right, vertex by vertex along the mean of the
 * neighbouring segments' normals, so lines sharing links (other lanes, the opposite direction)
 * run side by side.
 */
export function offsetPolyline(points: readonly MapPoint[], offset: number): readonly MapPoint[] {
  if (offset === 0) return points;
  const normals = segmentsOf(points).map(([a, b]) => normalOf(a, b));
  return points.map((point, index) => {
    const near = [normals[index - 1], normals[index]].filter((normal) => normal !== undefined);
    const nx = near.reduce((sum, normal) => sum + normal.x, 0) / Math.max(1, near.length);
    const ny = near.reduce((sum, normal) => sum + normal.y, 0) / Math.max(1, near.length);
    return { x: point.x + nx * offset, y: point.y + ny * offset };
  });
}

/** An arrowhead on a polyline's last segment, tip at its end. */
export function polylineHead(points: readonly MapPoint[], size: number): string {
  const tip = points[points.length - 1] ?? { x: 0, y: 0 };
  const tail = points[points.length - 2] ?? tip;
  const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
  const left = { x: tip.x - size * Math.cos(angle - 0.45), y: tip.y - size * Math.sin(angle - 0.45) };
  const right = { x: tip.x - size * Math.cos(angle + 0.45), y: tip.y - size * Math.sin(angle + 0.45) };
  return `${String(tip.x)},${String(tip.y)} ${String(left.x)},${String(left.y)} ${String(right.x)},${String(right.y)}`;
}

/** SVG path data for a polyline. */
export function polylinePath(points: readonly MapPoint[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${String(point.x)} ${String(point.y)}`).join(" ");
}

/** Right-hand side offset per lane, in screen pixels: lane 0 sits just right of the links, later lanes further out. */
export function laneOffset(lane: number): number {
  return 2.5 + 5 * lane;
}

/** A route as drawn: the trimmed, offset polyline, its arrowhead, and where its medallion and count badge sit. */
export interface RouteDrawing {
  readonly badge: MapPoint;
  readonly head: string;
  readonly length: number;
  readonly middle: MapPoint;
  readonly path: string;
  readonly points: readonly MapPoint[];
}

/** U8: the route's geometry, `unit` map units to a screen pixel. `RouteLayer` and the battle buttons share it. */
export function routeShape(route: Pick<RouteGroup, "from" | "lane" | "line" | "to">, points: RoutePoints, unit: number): RouteDrawing {
  const line = trimPolyline(offsetPolyline(routePoints(route, points), laneOffset(route.lane) * unit), 6 * unit, 10 * unit);
  return {
    badge: pointAlong(line, 0.8),
    head: polylineHead(line, 9 * unit),
    length: polylineLength(line),
    middle: pointAlong(line, 0.5),
    path: polylinePath(line),
    points: line
  };
}

function distance(a: MapPoint, b: MapPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** The unit normal to the right of a segment (in screen axes, y down); zero for a point. */
function normalOf(a: MapPoint, b: MapPoint): MapPoint {
  const length = distance(a, b);
  return length === 0 ? { x: 0, y: 0 } : { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
}
