import { type JSX, useMemo } from "react";
import { roadStyle } from "./layerChoice";
import { roadSegments } from "./roads";
import type { MapLayerProps } from "./slots";

/**
 * U8 (`r2-06-graph`, `r2-b-routes`): the Roads layer. Quiet straight lines between the towns of
 * bordering sub-territories: main roads solid and heavier, tracks faint and dashed. A mountain
 * pass gets a chevron at the middle of its link, naming the pass on hover.
 *
 * A `<g>` in screen pixels inside the vector layer's underlay, under the rail (`RailLayer`).
 */
export function RoadLayer({ scenarioPackage, toScreen }: Pick<MapLayerProps, "scenarioPackage" | "toScreen">): JSX.Element | null {
  const { map, scenario } = scenarioPackage;
  const segments = useMemo(() => roadSegments(scenario, map), [map, scenario]);
  if (segments.length === 0) return null;
  const placed = segments.map((segment) => ({ ...segment, a: toScreen(segment.a), b: toScreen(segment.b) }));
  return (
    <g className="road-layer" data-testid="road-layer">
      {placed.map(({ a, b, key, level }) => {
        if (level === undefined) return null;
        const style = roadStyle(level);
        return (
          <line
            className="road-line"
            data-level={level}
            key={key}
            strokeDasharray={style.dash}
            strokeOpacity={style.opacity}
            strokeWidth={style.width}
            x1={a.x}
            x2={b.x}
            y1={a.y}
            y2={b.y}
          />
        );
      })}
      {placed.map(({ a, b, key, pass }) => pass === undefined ? null : (
        // A click on the chevron only shows its name; it must not select or clear on the map below.
        <g
          aria-label={pass}
          className="road-pass"
          data-pass=""
          key={`pass-${key}`}
          onClick={(event) => { event.stopPropagation(); }}
          role="img"
          transform={`translate(${((a.x + b.x) / 2).toFixed(1)} ${((a.y + b.y) / 2).toFixed(1)})`}
        >
          <title>{pass}</title>
          <circle className="road-pass-disc" r={6} />
          <path className="road-pass-chevron" d="M-3.5 2 L0 -2 L3.5 2" />
        </g>
      ))}
    </g>
  );
}
