import type { CSSProperties, JSX, KeyboardEvent, MouseEvent } from "react";
import { useMemo } from "react";
import iberiaSvgSource from "../../../assets/maps/iberia.svg?raw";
import infantrySvgSource from "../../../assets/icons/nato/infantry.svg?raw";
import type {
  FactionDefinition,
  FactionId,
  TerritoryId,
  TurnOutcome,
  UnitId,
  UnitState
} from "../engine/types";
import {
  iberiaRegions,
  playableIberiaRegions,
  regionById,
  territoryAnchors,
  type IberiaRegion
} from "../maps/iberiaRegions";

interface IberiaMapProps {
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

interface PositionedUnit {
  readonly stackIndex: number;
  readonly unit: UnitState;
}

const mapViewBox = {
  height: 176,
  width: 225,
  x: 238,
  y: 535
} as const;

const uncontrolledColor = "#d8c59d";

export function IberiaMap({
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
}: IberiaMapProps): JSX.Element {
  const mapMarkup = useMemo(
    () =>
      prepareIberiaMapMarkup(
        iberiaSvgSource,
        legalDestinationIds,
        selectedDestinationId,
        selectedFromTerritoryId
      ),
    [legalDestinationIds, selectedDestinationId, selectedFromTerritoryId]
  );
  const positionedUnits = positionUnits(units);
  const mapColors = Object.fromEntries(
    playableIberiaRegions.map((region) => [
      `--territory-${region.territoryId}-color`,
      territoryColor(control[region.territoryId], factions)
    ])
  ) as CSSProperties;

  function selectTerritoryFromTarget(target: EventTarget | null): void {
    const territoryId = territoryIdFromTarget(target as Element);

    if (territoryId !== undefined) {
      onSelectTerritory(territoryId);
    }
  }

  return (
    <section aria-label="Iberia campaign map" className="iberia-map-section">
      <div
        className="iberia-map"
        onClick={(event: MouseEvent<HTMLDivElement>) => selectTerritoryFromTarget(event.target)}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectTerritoryFromTarget(event.target);
          }
        }}
        style={mapColors}
      >
        <div className="iberia-map-art" dangerouslySetInnerHTML={{ __html: mapMarkup }} />
        <MapOverlay factions={factions} outcomes={resolutionOutcomes} />
        {positionedUnits.map(({ stackIndex, unit }) => (
          <NatoUnitCounter
            faction={factionById(factions, unit.factionId)}
            isSelected={selectedUnitIds.includes(unit.id)}
            key={unit.id}
            onSelectUnit={onSelectUnit}
            stackIndex={stackIndex}
            unit={unit}
          />
        ))}
      </div>
      <MapLegend factions={factions} />
    </section>
  );
}

interface MapOverlayProps {
  readonly factions: readonly FactionDefinition[];
  readonly outcomes: readonly TurnOutcome[];
}

function MapOverlay({ factions, outcomes }: MapOverlayProps): JSX.Element {
  const featuredRegions = Object.entries(iberiaRegions).filter(([, region]) => region.showLabel);

  return (
    <svg
      aria-hidden="true"
      className="iberia-map-overlay"
      viewBox={`${mapViewBox.x} ${mapViewBox.y} ${mapViewBox.width} ${mapViewBox.height}`}
    >
      <defs>
        <marker id="iberia-arrowhead" markerHeight="5" markerWidth="5" orient="auto" refX="4" refY="2.5">
          <path d="M 0 0 L 5 2.5 L 0 5 Z" fill="context-stroke" />
        </marker>
      </defs>
      <text className="iberia-country-label" textAnchor="middle" x="270" y="625">
        Portugal
      </text>
      {featuredRegions.map(([regionId, region]) => (
        <MapRegionLabel key={regionId} region={region} />
      ))}
      <OrderAnnotations factions={factions} outcomes={outcomes} />
    </svg>
  );
}

function MapRegionLabel({ region }: { readonly region: IberiaRegion }): JSX.Element {
  const width = Math.max(30, region.name.length * 4.2);
  const x = region.anchor.x;
  const y = region.anchor.y - 13;

  return (
    <g className="iberia-region-label" transform={`translate(${x} ${y})`}>
      <rect height="11" rx="2" width={width} x={width / -2} y="-7.5" />
      <text textAnchor="middle" x="0" y="0">
        {region.name}
      </text>
    </g>
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
            markerEnd="url(#iberia-arrowhead)"
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

interface NatoUnitCounterProps {
  readonly faction: FactionDefinition;
  readonly isSelected: boolean;
  readonly onSelectUnit: (unitId: UnitId) => void;
  readonly stackIndex: number;
  readonly unit: UnitState;
}

function NatoUnitCounter({
  faction,
  isSelected,
  onSelectUnit,
  stackIndex,
  unit
}: NatoUnitCounterProps): JSX.Element {
  const iconMarkup = useMemo(() => prepareNatoIconMarkup(infantrySvgSource, faction.color), [faction.color]);
  const anchor = territoryAnchors[unit.territoryId];
  const left = ((anchor.x - mapViewBox.x) / mapViewBox.width) * 100 + stackIndex * 2.5;
  const top = ((anchor.y - mapViewBox.y) / mapViewBox.height) * 100 + stackIndex * 3;

  return (
    <button
      aria-label={unit.displayName}
      className={isSelected ? "nato-unit-counter nato-unit-counter-selected" : "nato-unit-counter"}
      onClick={(event) => {
        event.stopPropagation();
        onSelectUnit(unit.id);
      }}
      style={{ left: `${left}%`, top: `${top}%` }}
      type="button"
    >
      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconMarkup }} />
      <span className="nato-unit-abbreviation">{faction.abbreviation}</span>
    </button>
  );
}

function MapLegend({ factions }: { readonly factions: readonly FactionDefinition[] }): JSX.Element {
  return (
    <ul aria-label="Map legend" className="map-legend">
      {factions.map((faction) => (
        <li key={faction.id}>
          <span className="map-legend-swatch" style={{ background: faction.color }} />
          {faction.name}
        </li>
      ))}
      <li>
        <span className="map-legend-swatch map-legend-uncontrolled" />
        Uncontrolled
      </li>
      <li>
        <span className="map-legend-swatch map-legend-portugal" />
        Portugal
      </li>
    </ul>
  );
}

function prepareIberiaMapMarkup(
  source: string,
  legalDestinationIds: readonly TerritoryId[],
  selectedDestinationId: TerritoryId | undefined,
  selectedFromTerritoryId: TerritoryId | undefined
): string {
  const documentNode = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = documentNode.documentElement;

  root.removeAttribute("height");
  root.removeAttribute("style");
  root.removeAttribute("width");
  root.setAttribute("aria-label", "Iberian Peninsula regions");
  root.setAttribute("class", "iberia-map-svg");
  root.setAttribute("preserveAspectRatio", "xMidYMid meet");
  root.setAttribute("role", "group");
  root.setAttribute("viewBox", `${mapViewBox.x} ${mapViewBox.y} ${mapViewBox.width} ${mapViewBox.height}`);

  documentNode.querySelector("metadata")?.remove();
  documentNode.querySelector("#svg-background")?.remove();
  documentNode.querySelector("#map-group")?.removeAttribute("transform");
  documentNode.querySelector("#legend-svg")?.remove();
  documentNode.querySelector("#credit-text-svg")?.remove();
  documentNode.querySelector("#sidemap")?.remove();
  documentNode.querySelectorAll("script, foreignObject").forEach((element) => element.remove());

  Object.entries(iberiaRegions).forEach(([regionId, region]) => {
    const regionElement = documentNode.getElementById(regionId) as unknown as SVGElement;

    regionElement.setAttribute("aria-label", region.name);
    regionElement.setAttribute("data-country", region.country);
    regionElement.setAttribute("data-region-id", regionId);

    if (region.territoryId !== null) {
      regionElement.setAttribute("data-territory-id", region.territoryId);
      regionElement.setAttribute("role", "button");
      regionElement.setAttribute("tabindex", "0");
      regionElement.style.setProperty(
        "--region-color",
        `var(--territory-${region.territoryId}-color)`
      );

      if (legalDestinationIds.includes(region.territoryId)) {
        regionElement.setAttribute("data-legal-destination", "true");
      }

      if (selectedDestinationId === region.territoryId) {
        regionElement.setAttribute("data-selected-destination", "true");
      }

      if (selectedFromTerritoryId === region.territoryId) {
        regionElement.setAttribute("data-selected-origin", "true");
      }
    }

    const title = documentNode.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = region.name;
    regionElement.prepend(title);
  });

  return new XMLSerializer().serializeToString(root);
}

function prepareNatoIconMarkup(source: string, color: string): string {
  const documentNode = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = documentNode.documentElement;
  const fill = documentNode.getElementById("Friendly Fill") as Element;

  root.removeAttribute("height");
  root.removeAttribute("id");
  root.removeAttribute("width");
  root.setAttribute("class", "nato-unit-svg");
  root.setAttribute("viewBox", "0 0 600 400");

  fill.setAttribute(
    "style",
    `fill:${color};fill-opacity:1;stroke:#241d18;stroke-width:10;stroke-linejoin:miter`
  );

  documentNode.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));

  return new XMLSerializer().serializeToString(root);
}

function positionUnits(units: readonly UnitState[]): readonly PositionedUnit[] {
  return units.map((unit, index) => ({
    stackIndex: units.slice(0, index).filter((candidate) => candidate.territoryId === unit.territoryId).length,
    unit
  }));
}

function territoryColor(
  controller: FactionId | undefined,
  factions: readonly FactionDefinition[]
): string {
  return controller === undefined ? uncontrolledColor : factionById(factions, controller).color;
}

function territoryIdFromTarget(target: Element): TerritoryId | undefined {
  const regionId = target.closest("[data-region-id]")?.getAttribute("data-region-id");

  return regionId === null || regionId === undefined ? undefined : regionById(regionId)?.territoryId ?? undefined;
}

function factionById(factions: readonly FactionDefinition[], factionId: FactionId): FactionDefinition {
  return factions.find((candidate) => candidate.id === factionId) as FactionDefinition;
}
