import { type JSX, memo, useId } from "react";
import type { MapRiver } from "../scenarios/water";
import type { SemanticLevel } from "./camera";
import { displayText, riverLabelType, type VisibleWater, type WaterType, waterLabelType } from "./waterLabels";

/** River widths in screen pixels: the water, and the paler centre line drawn along it. */
const riverWidths: Readonly<Record<MapRiver["rank"], { readonly water: number; readonly centre: number }>> = {
  main: { centre: 0.8, water: 2.4 },
  tributary: { centre: 0.45, water: 1.4 }
};

/**
 * A mouth tapers in steps: each stroke covers the first `reach` of the stretch (as a fraction of
 * its length) at `width` of the full river, so the river narrows as it meets the sea.
 */
export const mouthTaper: readonly { readonly reach: number; readonly width: number }[] = [
  { reach: 0.25, width: 1 },
  { reach: 0.5, width: 0.8 },
  { reach: 0.75, width: 0.58 },
  { reach: 1, width: 0.36 }
];

interface RiverLayerProps {
  readonly level: SemanticLevel;
  readonly rivers: readonly MapRiver[];
  /** Map units per screen pixel. */
  readonly unit: number;
}

/**
 * Rivers as vector water (R1): above the territory wash, so they keep the sea's colour under
 * every faction, and below the borders. Main rivers show at every zoom, tributaries from the
 * operational zoom (R2). Scenery only (R3): they take no pointer input.
 */
export const RiverLayer = memo(function RiverLayer({ level, rivers, unit }: RiverLayerProps): JSX.Element {
  const shown = rivers.filter((river) => river.rank === "main" || level !== "overview");
  // Tributaries first, so main rivers draw over the confluences.
  const ordered = [...shown.filter((river) => river.rank === "tributary"), ...shown.filter((river) => river.rank === "main")];
  return (
    <g aria-hidden="true" className="map-rivers">
      {ordered.map((river) => {
        const width = riverWidths[river.rank];
        return (
          <g className={`map-river map-river-${river.rank}`} data-river-id={river.id} key={river.id}>
            <path className="map-river-water" d={river.path} strokeWidth={width.water * unit} />
            {river.mouth === undefined ? null : mouthTaper.map((step) => (
              <path
                className="map-river-water map-river-mouth"
                d={river.mouth}
                key={step.reach}
                pathLength={1}
                strokeDasharray={`${String(step.reach)} 2`}
                strokeWidth={width.water * step.width * unit}
              />
            ))}
            <path className="map-river-centre" d={river.path} strokeWidth={width.centre * unit} />
            {river.mouth === undefined ? null : (
              <path className="map-river-centre map-river-mouth" d={river.mouth} pathLength={1} strokeDasharray="0.55 2" strokeWidth={width.centre * 0.7 * unit} />
            )}
          </g>
        );
      })}
    </g>
  );
});

interface WaterLabelLayerProps {
  readonly unit: number;
  readonly water: VisibleWater;
}

/** Text attributes shared by every water name, scaled to constant screen size. */
function typeAttributes(type: WaterType, unit: number, letterSpacing = type.letterSpacing): { readonly fontSize: number; readonly letterSpacing: number; readonly strokeWidth: number } {
  return { fontSize: type.fontSize * unit, letterSpacing: letterSpacing * unit, strokeWidth: type.halo * unit };
}

/**
 * Water names (W1, W2, W5): open seas along their curve, gulfs and bays straight, and main
 * rivers along their course. Only the names that fit on screen clear of counters arrive here.
 */
export function WaterLabelLayer({ unit, water }: WaterLabelLayerProps): JSX.Element {
  // Curve ids must be unique on the page; React's ids carry characters a URL fragment should not.
  const prefix = useId().replace(/[^\w-]/g, "");
  const curveId = (index: number): string => `${prefix}water-curve-${String(index)}`;
  const riverId = (id: string): string => `${prefix}river-curve-${id}`;
  return (
    <g aria-hidden="true" className="map-water-labels">
      <defs>
        {water.labels.map(({ curve, label }, index) => curve === undefined ? null : <path d={curve.path} id={curveId(index)} key={label.text} />)}
        {water.riverLabels.map((river) => <path d={river.label.path} id={riverId(river.id)} key={river.id} />)}
      </defs>
      {water.labels.map(({ label, letterSpacing }, index) => {
        const type = waterLabelType[label.tier];
        const text = displayText(label.text, type);
        return label.kind === "curve" ? (
          <text className={`map-water-label map-water-${label.tier}`} key={label.text} {...typeAttributes(type, unit, letterSpacing)} textAnchor="middle">
            <textPath href={`#${curveId(index)}`} startOffset="50%">{text}</textPath>
          </text>
        ) : (
          <text className={`map-water-label map-water-${label.tier}`} key={label.text} {...typeAttributes(type, unit)} textAnchor="middle" x={label.x} y={label.y}>{text}</text>
        );
      })}
      {water.riverLabels.map((river) => (
        <text className="map-water-label map-river-label" key={river.id} {...typeAttributes(riverLabelType, unit)} textAnchor="middle">
          <textPath href={`#${riverId(river.id)}`} startOffset="50%">
            <tspan dy={-riverLabelType.lift * unit}>{river.name}</tspan>
          </textPath>
        </text>
      ))}
    </g>
  );
}
