import type { JSX } from "react";
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
  readonly path?: string;
  readonly circle?: {
    readonly cx: number;
    readonly cy: number;
    readonly r: number;
  };
  readonly labelX: number;
  readonly labelY: number;
}

const territoryShapes: readonly TerritoryShape[] = [
  {
    id: "north",
    label: "North",
    path: "M 0 0 H 100 V 50 H 0 Z M 50 22 A 28 28 0 0 1 78 50 H 22 A 28 28 0 0 1 50 22 Z",
    labelX: 50,
    labelY: 16
  },
  {
    id: "southwest",
    label: "Southwest",
    path: "M 0 50 H 50 V 100 H 0 Z M 22 50 A 28 28 0 0 0 50 78 V 50 Z",
    labelX: 24,
    labelY: 86
  },
  {
    id: "eastern-port",
    label: "Eastern Port",
    path: "M 50 50 H 100 V 100 H 50 Z M 78 50 A 28 28 0 0 1 50 78 V 50 Z M 50 0 H 100 V 50 H 78 A 28 28 0 0 0 50 22 Z",
    labelX: 76,
    labelY: 84
  },
  {
    id: "center",
    label: "Center",
    circle: { cx: 50, cy: 50, r: 28 },
    labelX: 50,
    labelY: 53
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
        const unitCount = units.filter((unit) => unit.territoryId === shape.id).length;
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
                onClick={() => onSelectTerritory(shape.id)}
                role="button"
                tabIndex={0}
              />
            )}
            <text className="map-label" textAnchor="middle" x={shape.labelX} y={shape.labelY}>
              {shape.label}
            </text>
            {unitCount > 0 ? (
              <text className="map-unit-count" textAnchor="middle" x={shape.labelX} y={shape.labelY + 7}>
                {unitCount} soldier{unitCount === 1 ? "" : "s"}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
