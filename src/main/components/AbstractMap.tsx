import type { JSX, KeyboardEvent } from "react";
import type {
  FactionDefinition,
  FactionId,
  TerritoryId,
  TurnOutcome,
  UnitId,
  UnitState
} from "../engine/types";

interface AbstractMapProps {
  readonly control: Partial<Record<TerritoryId, FactionId>>;
  readonly factions: readonly FactionDefinition[];
  readonly legalDestinationIds: readonly TerritoryId[];
  readonly onSelectTerritory: (territoryId: TerritoryId) => void;
  readonly onSelectUnit: (unitId: UnitId) => void;
  readonly resolutionOutcomes?: readonly TurnOutcome[];
  readonly selectedDestinationId: TerritoryId | undefined;
  readonly selectedFromTerritoryId: TerritoryId | undefined;
  readonly selectedUnitIds: readonly UnitId[];
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

interface TerritoryAnchor {
  readonly x: number;
  readonly y: number;
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

const territoryAnchors: Record<TerritoryId, TerritoryAnchor> = {
  center: { x: 50, y: 58 },
  "eastern-port": { x: 76, y: 91 },
  north: { x: 50, y: 21 },
  southwest: { x: 24, y: 93 }
};

export function AbstractMap({
  control,
  factions,
  legalDestinationIds,
  onSelectTerritory,
  onSelectUnit,
  resolutionOutcomes = [],
  selectedDestinationId,
  selectedFromTerritoryId,
  selectedUnitIds,
  units
}: AbstractMapProps): JSX.Element {
  return (
    <svg className="abstract-map" role="img" aria-label="Milestone 1 territory map" viewBox="0 0 100 100">
      <defs>
        <marker id="arrowhead" markerHeight="4" markerWidth="4" orient="auto" refX="3.4" refY="2">
          <path d="M 0 0 L 4 2 L 0 4 Z" />
        </marker>
      </defs>
      {territoryShapes.map((shape) => {
        const controller = control[shape.id];
        const classes = [
          "map-territory",
          controller === undefined ? "" : `map-control-${controller}`,
          selectedFromTerritoryId === shape.id ? "map-territory-selected" : "",
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
                onKeyDown={(event) => handleTerritoryKeyDown(event, () => onSelectTerritory(shape.id))}
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
                onKeyDown={(event) => handleTerritoryKeyDown(event, () => onSelectTerritory(shape.id))}
                role="button"
                tabIndex={0}
              />
            )}
          </g>
        );
      })}
      <OrderAnnotations factions={factions} outcomes={resolutionOutcomes} />
      {territoryShapes.map((shape) => (
        <MapLabel key={shape.id} shape={shape} />
      ))}
      {units.map((unit, index) => (
        <UnitCounter
          faction={factionById(factions, unit.factionId)}
          index={index}
          isSelected={selectedUnitIds.includes(unit.id)}
          key={unit.id}
          onSelectUnit={onSelectUnit}
          unit={unit}
        />
      ))}
    </svg>
  );
}

interface OrderAnnotationsProps {
  readonly factions: readonly FactionDefinition[];
  readonly outcomes: readonly TurnOutcome[];
}

function OrderAnnotations({ factions, outcomes }: OrderAnnotationsProps): JSX.Element {
  return (
    <g className="map-annotations">
      {outcomes.flatMap((outcome) => {
        if (outcome.kind === "no-move" || outcome.kind === "invalid-order") {
          return [];
        }

        const from = territoryAnchors[outcome.order.from];
        const to = territoryAnchors[outcome.order.to];
        const faction = factionById(factions, outcome.order.factionId);
        const midpoint = {
          x: (from.x + to.x) / 2,
          y: (from.y + to.y) / 2
        };

        return [
          <line
            className="map-order-arrow"
            key={`${outcome.order.unitId}-arrow`}
            markerEnd="url(#arrowhead)"
            style={{ color: faction.color }}
            x1={from.x}
            x2={to.x}
            y1={from.y}
            y2={to.y}
          />,
          outcome.kind === "bounced-move" ? (
            <text className="map-bounce-marker" key={`${outcome.order.unitId}-bounce`} x={midpoint.x} y={midpoint.y}>
              x
            </text>
          ) : null,
          outcome.kind === "disbanded-move" ? (
            <text className="map-skull-marker" key={`${outcome.order.unitId}-skull`} x={midpoint.x} y={midpoint.y}>
              skull
            </text>
          ) : null
        ];
      })}
    </g>
  );
}

interface UnitCounterProps {
  readonly faction: FactionDefinition;
  readonly index: number;
  readonly isSelected: boolean;
  readonly onSelectUnit: (unitId: UnitId) => void;
  readonly unit: UnitState;
}

function UnitCounter({ faction, index, isSelected, onSelectUnit, unit }: UnitCounterProps): JSX.Element {
  const anchor = territoryAnchors[unit.territoryId];
  const x = anchor.x + (index % 2) * 8 - 4;
  const y = anchor.y + Math.floor(index / 2) * 7;

  return (
    <g
      aria-label={unit.displayName}
      className={isSelected ? "unit-counter unit-counter-selected" : "unit-counter"}
      onClick={(event) => {
        event.stopPropagation();
        onSelectUnit(unit.id);
      }}
      role="button"
      tabIndex={0}
      transform={`translate(${x} ${y})`}
    >
      <rect height="7" rx="0.8" style={{ fill: faction.color }} width="12" x="-6" y="-4" />
      <text className="unit-counter-symbol" textAnchor="middle" x="0" y="1.2">
        X
      </text>
    </g>
  );
}

interface MapLabelProps {
  readonly shape: TerritoryShape;
}

function MapLabel({ shape }: MapLabelProps): JSX.Element {
  const titleLines = shape.titleLines ?? [shape.label];
  const fontSize = Math.min(4.2, Math.max(2.8, shape.labelWidth / longestLineLength(titleLines) / 1.35));
  const lineHeight = fontSize * 1.35;
  const labelHeight = lineHeight * titleLines.length + 2.4;
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
      {titleLines.map((line, index) => (
        <text
          className="map-label"
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

function factionById(factions: readonly FactionDefinition[], factionId: FactionId): FactionDefinition {
  const faction = factions.find((candidate) => candidate.id === factionId);

  if (faction === undefined) {
    throw new Error(`Unknown faction: ${factionId}`);
  }

  return faction;
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
