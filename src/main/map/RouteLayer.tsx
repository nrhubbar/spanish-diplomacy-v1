import type { JSX } from "react";
import type { FactionId, TerritoryId } from "../engine/types";
import type { MapPoint } from "../scenarios/loader";
import { arrowHead, groupRoutes, laneBend, pointOnCurve, type RouteGroup, routeCurve, shortenCurve } from "./routes";
import type { MapView } from "./view";

interface RouteLayerProps {
  readonly anchor: (id: TerritoryId) => MapPoint;
  readonly factionColor: (id: FactionId) => string;
  /** Map units per screen pixel. */
  readonly unit: number;
  readonly view: MapView;
}

/** Planned moves and last turn's results, one route per group (V10). */
export function RouteLayer({ anchor, factionColor, unit, view }: RouteLayerProps): JSX.Element {
  return (
    <g className="map-routes" aria-hidden="true">
      {groupRoutes(view.plannedOrders, view.outcomes).map((route) => (
        <Route anchor={anchor} factionColor={factionColor(route.factionId)} key={route.key} route={route} unit={unit} />
      ))}
    </g>
  );
}

/** Routes shorter than this on screen draw a faction-colored arrowhead. */
const shortRoutePixels = 90;

interface RouteProps {
  readonly anchor: (id: TerritoryId) => MapPoint;
  readonly factionColor: string;
  readonly route: RouteGroup;
  readonly unit: number;
}

/**
 * One route: a paper halo so it reads on any terrain, a line (dashed while planned or failed,
 * solid once completed) colored by result, and an arrowhead. A medallion halfway along, away
 * from the counters at either end, names the faction by its color and the result by its icon.
 * The count badge sits near the arrowhead, clear of the origin's counters.
 */
function Route({ anchor, factionColor, route, unit }: RouteProps): JSX.Element {
  const curve = shortenCurve(routeCurve(anchor(route.from), anchor(route.to), 0.18 + laneBend * route.lane), 6 * unit, 10 * unit);
  const head = arrowHead(curve, 9 * unit);
  const middle = pointOnCurve(curve, 0.5);
  const badge = pointOnCurve(curve, 0.8);
  const dashed = route.kind === "planned" || route.kind === "bounced" || route.kind === "disbanded";
  // On a route shorter than a counter cluster the medallion can sit under counters, so the
  // arrowhead takes the faction color too.
  const short = Math.hypot(curve.end.x - curve.start.x, curve.end.y - curve.start.y) / unit < shortRoutePixels;
  const d = `M ${String(curve.start.x)} ${String(curve.start.y)} Q ${String(curve.control.x)} ${String(curve.control.y)} ${String(curve.end.x)} ${String(curve.end.y)}`;
  return (
    <g className={`map-route map-route-${route.kind}`} data-route-kind={route.kind}>
      <path className="map-route-halo" d={d} strokeWidth={6 * unit} />
      <path
        className="map-route-line"
        d={d}
        strokeDasharray={dashed ? `${String(7 * unit)} ${String(4 * unit)}` : undefined}
        strokeWidth={3 * unit}
      />
      <polygon
        className="map-route-head"
        data-faction-head={short ? "" : undefined}
        points={head.points}
        strokeWidth={2.4 * unit}
        style={short ? { fill: factionColor, stroke: "#241d18" } : undefined}
      />
      <RouteMedallion center={middle} factionColor={factionColor} kind={route.kind} unit={unit} />
      {route.count > 1 ? (
        <g className="map-route-badge" transform={`translate(${String(badge.x)} ${String(badge.y)}) scale(${String(unit)})`}>
          <rect className="map-route-count" height={15} rx={7.5} stroke={factionColor} strokeWidth={2} width={22} x={-11} y={-7.5} />
          <text className="map-route-count-text" fontSize={10.5} textAnchor="middle" y={3.8}>{`x${String(route.count)}`}</text>
        </g>
      ) : null}
    </g>
  );
}

/**
 * Faction ring plus result: a bounce or loss icon inside a ring of the moving faction's color,
 * or, for planned and completed moves, a plain faction-colored token.
 */
function RouteMedallion({ center, factionColor, kind, unit }: { readonly center: MapPoint; readonly factionColor: string; readonly kind: RouteGroup["kind"]; readonly unit: number }): JSX.Element {
  const transform = `translate(${String(center.x)} ${String(center.y)}) scale(${String(unit)})`;
  if (kind === "planned" || kind === "moved") {
    return (
      <g className="map-route-faction" data-faction-mark="" transform={transform}>
        <circle fill={factionColor} r={4.6} stroke="#241d18" strokeWidth={1.3} />
      </g>
    );
  }
  return (
    <g className={`map-outcome map-outcome-${kind}`} data-faction-mark="" transform={transform}>
      <circle className="map-outcome-ring" fill={factionColor} r={11.5} stroke="#241d18" strokeWidth={1.2} />
      <circle className="map-outcome-body" r={8.2} stroke="#fffaf0" strokeWidth={1.4} />
      {kind === "bounced"
        ? <path d="M -1.4 -3.9 L -4.6 0 L -1.4 3.9 M 1.4 -3.9 L 4.6 0 L 1.4 3.9" fill="none" stroke="#fffaf0" strokeLinecap="round" strokeWidth={1.8} />
        : <path d="M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5" fill="none" stroke="#fffaf0" strokeLinecap="round" strokeWidth={2} />}
    </g>
  );
}
