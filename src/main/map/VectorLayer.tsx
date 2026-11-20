import { type JSX, memo } from "react";
import type { FactionId, GameState, Scenario, TerritoryId } from "../engine/types";
import type { MapPackage, MapRect } from "../scenarios/loader";
import { requireFaction } from "../engine/lookup";
import { territoryName } from "../presentation/text";
import { territoryAnchor } from "./anchors";
import type { SemanticLevel } from "./camera";
import type { PreparedGeometry } from "./markup";
import { contextLabelType } from "./placement";
import { RouteLayer } from "./RouteLayer";
import { routeCurve } from "./routes";
import { highlightedTerritoryId, type MapView } from "./view";
import { RiverLayer, WaterLabelLayer } from "./WaterLayer";
import type { VisibleWater } from "./waterLabels";

interface VectorLayerProps {
  /** The neutral labels to draw, already checked against the screen edges and counters. */
  readonly contextLabels: MapPackage["contextLabels"];
  readonly game: GameState;
  readonly geometry: PreparedGeometry;
  readonly level: SemanticLevel;
  readonly map: MapPackage;
  /** Map units per screen pixel; every stroke, label, and icon is sized with it (V1). */
  readonly unit: number;
  readonly scenario: Scenario;
  readonly view: MapView;
  readonly visible: MapRect;
  /** The water names to draw, already checked against the screen edges and counters. */
  readonly water: VisibleWater;
}

/** Stable region geometry; re-rendered only when the package changes, never on pan or zoom. */
const Geometry = memo(function Geometry({ markup }: { readonly markup: string }): JSX.Element {
  return <g className="map-geometry" dangerouslySetInnerHTML={{ __html: markup }} />;
});

/**
 * Region borders, drawn from the same outlines as the regions but in their own layer, so rivers
 * can sit between the territory wash and the borders (R1).
 */
const Borders = memo(function Borders({ outlines }: { readonly outlines: PreparedGeometry["outlines"] }): JSX.Element {
  return <g aria-hidden="true" className="map-borders" dangerouslySetInnerHTML={{ __html: [...outlines.values()].join("") }} />;
});

export function VectorLayer({ contextLabels, game, geometry, level, map, scenario, unit, view, visible, water }: VectorLayerProps): JSX.Element {
  const factionColor = (id: FactionId): string => requireFaction(scenario, id).color;
  const anchor = (id: TerritoryId) => territoryAnchor(map, id);
  const showDetail = level !== "overview";
  const highlighted = highlightedTerritoryId(view);

  return (
    <svg
      aria-label="Territories"
      className="map-vector"
      preserveAspectRatio="none"
      role="group"
      viewBox={`${String(visible.x)} ${String(visible.y)} ${String(visible.width)} ${String(visible.height)}`}
    >
      <defs>
        {scenario.territories.map((territory) => {
          const control = game.control[territory.id];
          if (control?.kind !== "contested") return null;
          const stripe = 6 * unit;
          return (
            <pattern height={stripe * control.factionIds.length} id={`contested-${territory.id}`} key={territory.id} patternTransform="rotate(45)" patternUnits="userSpaceOnUse" width={stripe * control.factionIds.length}>
              {control.factionIds.map((factionId, index) => (
                <rect fill={factionColor(factionId)} height={stripe * control.factionIds.length} key={factionId} width={stripe} x={stripe * index} y={0} />
              ))}
            </pattern>
          );
        })}
      </defs>
      <style>{territoryStyles(scenario, game, view, factionColor)}</style>
      <Geometry markup={geometry.markup} />
      <g className="map-shapes">
        {[...map.territories].map(([territoryId, entry]) => entry.shape === undefined ? null : (
          <circle
            aria-label={territoryName(scenario, territoryId)}
            className="map-region map-shape"
            cx={entry.shape.x}
            cy={entry.shape.y}
            data-territory-id={territoryId}
            key={territoryId}
            r={Math.max(entry.shape.r, 9 * unit)}
            role="button"
            tabIndex={0}
          />
        ))}
      </g>
      <RiverLayer level={level} rivers={map.rivers} unit={unit} />
      <Borders outlines={geometry.outlines} />
      <g className="map-highlights" aria-hidden="true">
        {view.changedTerritoryIds.map((id) => <Highlight geometry={geometry} key={`changed-${id}`} kind="changed" map={map} territoryId={id} />)}
        {view.destinationIds.map((id) => <Highlight geometry={geometry} key={`destination-${id}`} kind="destination" map={map} territoryId={id} />)}
        {highlighted === undefined ? null : <Highlight geometry={geometry} kind="origin" map={map} territoryId={highlighted} />}
      </g>
      <g className="map-sea-lanes" aria-hidden="true">
        {scenario.connections.filter((connection) => connection.kind === "sea").map((connection) => {
          const [a, b] = connection.between;
          const curve = routeCurve(anchor(a), anchor(b), 0.12);
          return (
            <path
              d={`M ${String(curve.start.x)} ${String(curve.start.y)} Q ${String(curve.control.x)} ${String(curve.control.y)} ${String(curve.end.x)} ${String(curve.end.y)}`}
              key={`${a}-${b}`}
              strokeDasharray={`${String(2 * unit)} ${String(5 * unit)}`}
              strokeWidth={1.6 * unit}
            />
          );
        })}
      </g>
      <WaterLabelLayer unit={unit} water={water} />
      <g className="map-context-labels" aria-hidden="true">
        {contextLabels.map((label) => (
          <text fontSize={contextLabelType.fontSize * unit} key={label.text} letterSpacing={contextLabelType.letterSpacing * unit} textAnchor="middle" x={label.x} y={label.y}>{label.text.toUpperCase()}</text>
        ))}
      </g>
      <g className="map-territory-labels" aria-hidden="true">
        {[...map.territories].map(([territoryId, entry]) => {
          if (entry.label.tier === "detail" && !showDetail) return null;
          const name = territoryName(scenario, territoryId);
          return (
            <text fontSize={12.5 * unit} key={territoryId} strokeWidth={3.5 * unit} textAnchor="middle" x={entry.label.x} y={entry.label.y}>{name}</text>
          );
        })}
      </g>
      <g className="map-cities" aria-hidden="true">
        {scenario.cities.map((city) => {
          const position = map.cities.get(city.id);
          if (position === undefined) return null;
          const controller = game.cityControl[city.id];
          const labelled = position.tier === "overview" || showDetail;
          return (
            <g key={city.id}>
              <circle cx={position.x} cy={position.y} fill={controller === undefined ? "#d8c59d" : factionColor(controller)} r={3.4 * unit} stroke="#241d18" strokeWidth={1.1 * unit} />
              {labelled ? (
                <text fontSize={11.5 * unit} strokeWidth={3 * unit} x={position.x + 5.5 * unit} y={position.y + 4 * unit}>{city.name}</text>
              ) : null}
            </g>
          );
        })}
      </g>
      <RouteLayer anchor={anchor} factionColor={factionColor} scenario={scenario} unit={unit} view={view} />
    </svg>
  );
}

type HighlightKind = "changed" | "destination" | "origin";

/**
 * Stacked strokes per highlight kind, bottom first. An ink casing keeps gold readable on any
 * terrain or faction wash. Destinations add a moving glint (soft halo plus bright core) so a
 * selectable territory shimmers; the solid, glowing origin stays still.
 */
const highlightStrokes: Readonly<Record<HighlightKind, readonly string[]>> = {
  changed: ["line"],
  destination: ["casing", "line", "glint-halo", "glint"],
  origin: ["casing", "line"]
};

/** Outline drawn above all regions so a selection is never hidden by a neighbor's border. */
function Highlight({ geometry, kind, map, territoryId }: { readonly geometry: PreparedGeometry; readonly kind: HighlightKind; readonly map: MapPackage; readonly territoryId: TerritoryId }): JSX.Element {
  const shape = map.territories.get(territoryId)?.shape;
  const outline = geometry.outlines.get(territoryId) ?? "";
  return (
    <g className={`map-highlight map-highlight-${kind}`} data-highlight={kind} data-territory-highlight={territoryId}>
      {highlightStrokes[kind].map((stroke) => (
        <g className={`map-highlight-${stroke}`} key={stroke}>
          <g dangerouslySetInnerHTML={{ __html: outline }} />
          {shape === undefined ? null : <circle cx={shape.x} cy={shape.y} r={shape.r} />}
        </g>
      ))}
    </g>
  );
}

/** Generated per-territory CSS: control wash and contested hatch. */
function territoryStyles(scenario: Scenario, game: GameState, view: MapView, factionColor: (id: FactionId) => string): string {
  const rules: string[] = [];
  for (const territory of scenario.territories) {
    const control = game.control[territory.id];
    const selector = `[data-territory-id="${territory.id}"]`;
    if (control?.kind === "controlled") {
      rules.push(`${selector}{fill:${factionColor(control.factionId)};}`);
    } else if (control?.kind === "contested") {
      rules.push(`${selector}{fill:url(#contested-${territory.id});fill-opacity:var(--contested-opacity);}`);
    }
  }
  for (const id of view.destinationIds) {
    rules.push(`.map-region[data-territory-id="${id}"]{fill-opacity:var(--destination-opacity);}`);
  }
  return rules.join("\n");
}
