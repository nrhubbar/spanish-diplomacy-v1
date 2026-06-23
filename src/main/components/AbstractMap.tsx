import type { JSX, KeyboardEvent } from "react";
import type { TerritoryId, UnitState } from "../engine/types";

interface AbstractMapProps {
  readonly legalDestinationIds: readonly TerritoryId[];
  readonly onSelectTerritory: (territoryId: TerritoryId) => void;
  readonly selectedDestinationId: TerritoryId | undefined;
  readonly selectedTerritoryId: TerritoryId | undefined;
  readonly units: readonly UnitState[];
}

interface TerritoryShape {
  readonly id: TerritoryId;
  readonly label: string;
  readonly labelWidth: number;
  readonly path?: string;
  readonly circle?: {
    readonly cx: number;
    readonly cy: number;
    readonly r: number;
  };
  readonly labelX: number;
  readonly labelY: number;
  readonly titleLines?: readonly string[];
}

const territoryShapes: readonly TerritoryShape[] = [
  {
    id: "north",
    label: "North",
    path: "M 0 0 H 100 V 50 H 78 A 28 28 0 0 0 22 50 H 0 Z M 50 22 A 28 28 0 0 1 78 50 H 22 A 28 28 0 0 1 50 22 Z",
    labelWidth: 20,
    labelX: 50,
    labelY: 9
  },
  {
    id: "southwest",
    label: "Southwest",
    path: "M 0 50 H 50 V 100 H 0 Z M 22 50 A 28 28 0 0 0 50 78 V 50 Z",
    labelWidth: 30,
    labelX: 24,
    labelY: 84
  },
  {
    id: "eastern-port",
    label: "Eastern Port",
    path: "M 50 50 H 100 V 100 H 50 Z M 78 50 A 28 28 0 0 1 50 78 V 50 Z",
    labelWidth: 30,
    labelX: 76,
    labelY: 81,
    titleLines: ["Eastern", "Port"]
  },
  {
    id: "center",
    label: "Center",
    circle: { cx: 50, cy: 50, r: 28 },
    labelWidth: 24,
    labelX: 50,
    labelY: 47
  }
];

export function AbstractMap({
  legalDestinationIds,
  onSelectTerritory,
  selectedDestinationId,
  selectedTerritoryId,
  units
}: AbstractMapProps): JSX.Element {
  return (
    <svg className="abstract-map" role="img" aria-label="Milestone 1 territory map" viewBox="0 0 100 100">
      {territoryShapes.map((shape) => {
        const classes = [
          "map-territory",
          selectedTerritoryId === shape.id ? "map-territory-selected" : "",
          selectedDestinationId === shape.id ? "map-territory-destination" : "",
          legalDestinationIds.includes(shape.id) ? "map-territory-legal" : ""
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <g key={shape.id}>
            {shape.path === undefined ? (
              <circle
                aria-label={shape.label}
                className={classes}
                onKeyDown={(event) => handleTerritoryKeyDown(event, () => onSelectTerritory(shape.id))}
                onClick={() => onSelectTerritory(shape.id)}
                role="button"
                tabIndex={0}
                {...shape.circle}
              />
            ) : (
              <path
                aria-label={shape.label}
                className={classes}
                d={shape.path}
                fillRule="evenodd"
                onKeyDown={(event) => handleTerritoryKeyDown(event, () => onSelectTerritory(shape.id))}
                onClick={() => onSelectTerritory(shape.id)}
                role="button"
                tabIndex={0}
              />
            )}
          </g>
        );
      })}
      {territoryShapes.map((shape) => (
        <MapLabel
          key={shape.id}
          shape={shape}
          unitCount={units.filter((unit) => unit.territoryId === shape.id).length}
        />
      ))}
    </svg>
  );
}

interface MapLabelProps {
  readonly shape: TerritoryShape;
  readonly unitCount: number;
}

function MapLabel({ shape, unitCount }: MapLabelProps): JSX.Element {
  const titleLines = shape.titleLines ?? [shape.label];
  const unitLine = unitCount > 0 ? `${unitCount} soldier${unitCount === 1 ? "" : "s"}` : undefined;
  const lines = unitLine === undefined ? titleLines : [...titleLines, unitLine];
  const fontSize = Math.min(4.2, Math.max(2.8, shape.labelWidth / longestLineLength(lines) / 1.35));
  const lineHeight = fontSize * 1.35;
  const labelHeight = lineHeight * lines.length + 2.4;
  const labelY = shape.labelY - lineHeight;

  return (
    <g className="map-label-group" transform={`translate(${shape.labelX} ${labelY})`}>
      <rect
        className="map-label-backplate"
        height={labelHeight}
        rx="1.8"
        width={shape.labelWidth}
        x={shape.labelWidth / -2}
        y="0"
      />
      {lines.map((line, index) => (
        <text
          className={index < titleLines.length ? "map-label" : "map-unit-count"}
          key={`${shape.id}-${line}`}
          textAnchor="middle"
          x="0"
          y={2.8 + lineHeight * (index + 0.75)}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

function longestLineLength(lines: readonly string[]): number {
  return Math.max(...lines.map((line) => line.length));
}

function handleTerritoryKeyDown(event: KeyboardEvent<SVGElement>, onSelect: () => void): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSelect();
  }
}
