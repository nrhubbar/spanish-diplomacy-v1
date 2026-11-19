import type { BattleOutcome, BattleResult, FactionId, MoveOrder, TerritoryId, TurnOutcome, UnitId } from "../engine/types";
import { affectedFaction } from "../presentation/battle";
import type { MapPoint } from "../scenarios/loader";

export type RouteKind = "planned" | "moved" | "bounced" | "disbanded" | "battle";

/** A battle fought at the end of a route: its result and the faction the result fell on. */
export interface RouteBattle {
  readonly affectedFactionId: FactionId;
  readonly result: BattleResult;
}

export interface RouteGroup {
  /** Set on routes that ended in a battle; the route shows the battle's medallion. */
  readonly battle?: RouteBattle;
  readonly count: number;
  readonly factionId: FactionId;
  readonly from: TerritoryId;
  readonly key: string;
  readonly kind: RouteKind;
  /** 0 for the first route between this origin and destination; later ones bow further out. */
  readonly lane: number;
  readonly to: TerritoryId;
}

interface RouteEntry {
  readonly battle?: RouteBattle;
  readonly factionId: FactionId;
  readonly from: TerritoryId;
  readonly kind: RouteKind;
  readonly to: TerritoryId;
  readonly unitId: UnitId;
}

/**
 * The moves that ended in a battle: attackers (and, on the road or into an empty territory,
 * the other side too) from where they set out to where they fought. Standing battles (M27)
 * moved nobody, so they draw no route.
 */
export function battleRoutes(battle: BattleOutcome): readonly RouteEntry[] {
  const mark: RouteBattle = { affectedFactionId: affectedFaction(battle), result: battle.result };
  const { site } = battle;
  const armies = site.kind === "assault" ? battle.attacker.armies : [...battle.attacker.armies, ...battle.defender.armies];
  return armies.flatMap((army) => {
    const to = site.kind === "meeting" ? site.between.find((id) => id !== army.from) : site.territoryId;
    return to === undefined || to === army.from ? [] : [{ battle: mark, factionId: army.factionId, from: army.from, kind: "battle", to, unitId: army.unitId }];
  });
}

/** Extra bend per lane, so routes that share an origin and destination never share a curve. */
export const laneBend = 0.16;

/**
 * V10: one route per (origin, destination, faction, result), with a count instead of duplicates.
 * Routes of different factions or results along the same origin and destination get their own lane.
 */
export function groupRoutes(planned: readonly MoveOrder[], outcomes: readonly TurnOutcome[]): readonly RouteGroup[] {
  const fromOrder = (kind: RouteKind, order: MoveOrder): RouteEntry => ({ factionId: order.factionId, from: order.from, kind, to: order.to, unitId: order.unitId });
  const fought = outcomes.flatMap((outcome) => (outcome.kind === "battle" ? battleRoutes(outcome) : []));
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
  for (const { battle, factionId, from, kind, to } of entries) {
    const key = `${kind}:${battle?.result ?? ""}:${factionId}:${from}:${to}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      const pair = `${from}:${to}`;
      const lane = lanes.get(pair) ?? 0;
      lanes.set(pair, lane + 1);
      groups.set(key, { ...(battle === undefined ? {} : { battle }), count: 1, factionId, from, key, kind, lane, to });
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
