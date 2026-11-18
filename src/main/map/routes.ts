import type { FactionId, MoveOrder, TerritoryId, TurnOutcome } from "../engine/types";
import type { MapPoint } from "../scenarios/loader";

export type RouteKind = "planned" | "moved" | "bounced" | "disbanded";

export interface RouteGroup {
  readonly count: number;
  readonly factionId: FactionId;
  readonly from: TerritoryId;
  readonly key: string;
  readonly kind: RouteKind;
  /** 0 for the first route between this origin and destination; later ones bow further out. */
  readonly lane: number;
  readonly to: TerritoryId;
}

/** Extra bend per lane, so routes that share an origin and destination never share a curve. */
export const laneBend = 0.16;

/**
 * V10: one route per (origin, destination, faction, result), with a count instead of duplicates.
 * Routes of different factions or results along the same origin and destination get their own lane.
 */
export function groupRoutes(planned: readonly MoveOrder[], outcomes: readonly TurnOutcome[]): readonly RouteGroup[] {
  type Entry = { readonly kind: RouteKind; readonly order: MoveOrder };
  const fromOutcome = (outcome: TurnOutcome): readonly Entry[] => {
    switch (outcome.kind) {
      case "successful-move":
        return [{ kind: "moved", order: outcome.order }];
      case "bounced-move":
        return [{ kind: "bounced", order: outcome.order }];
      case "disbanded-move":
        return [{ kind: "disbanded", order: outcome.order }];
      default:
        return [];
    }
  };
  const entries: readonly Entry[] = [
    ...planned.map((order): Entry => ({ kind: "planned", order })),
    ...outcomes.flatMap(fromOutcome)
  ];
  const groups = new Map<string, RouteGroup>();
  const lanes = new Map<string, number>();
  for (const { kind, order } of entries) {
    const key = `${kind}:${order.factionId}:${order.from}:${order.to}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      const pair = `${order.from}:${order.to}`;
      const lane = lanes.get(pair) ?? 0;
      lanes.set(pair, lane + 1);
      groups.set(key, { count: 1, factionId: order.factionId, from: order.from, key, kind, lane, to: order.to });
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

/** A gentle quadratic arc; opposite directions bow to opposite sides so they never overlap. */
export function routeCurve(from: MapPoint, to: MapPoint, bend = 0.18): RouteCurve {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return {
    control: { x: (from.x + to.x) / 2 - dy * bend, y: (from.y + to.y) / 2 + dx * bend },
    end: to,
    start: from
  };
}

export function pointOnCurve(curve: RouteCurve, t: number): MapPoint {
  const inverse = 1 - t;
  return {
    x: inverse * inverse * curve.start.x + 2 * inverse * t * curve.control.x + t * t * curve.end.x,
    y: inverse * inverse * curve.start.y + 2 * inverse * t * curve.control.y + t * t * curve.end.y
  };
}

/** Trims the curve end by `trim` map units so an arrowhead lands short of the anchor. */
export function arrowHead(curve: RouteCurve, size: number): { readonly points: string; readonly tip: MapPoint } {
  const angle = Math.atan2(curve.end.y - curve.control.y, curve.end.x - curve.control.x);
  const tip = curve.end;
  const left = { x: tip.x - size * Math.cos(angle - 0.45), y: tip.y - size * Math.sin(angle - 0.45) };
  const right = { x: tip.x - size * Math.cos(angle + 0.45), y: tip.y - size * Math.sin(angle + 0.45) };
  return { points: `${String(tip.x)},${String(tip.y)} ${String(left.x)},${String(left.y)} ${String(right.x)},${String(right.y)}`, tip };
}

export function shortenCurve(curve: RouteCurve, startTrim: number, endTrim: number): RouteCurve {
  const length = Math.hypot(curve.end.x - curve.start.x, curve.end.y - curve.start.y);
  if (length === 0) return curve;
  const startT = Math.min(0.4, startTrim / length);
  const endT = Math.max(0.6, 1 - endTrim / length);
  return {
    control: curve.control,
    end: pointOnCurve(curve, endT),
    start: pointOnCurve(curve, startT)
  };
}
