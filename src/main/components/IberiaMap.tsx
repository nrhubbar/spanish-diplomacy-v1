import type { CSSProperties, JSX, KeyboardEvent, MouseEvent, PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import iberiaSvgSource from "../../../assets/maps/iberia-registered.svg?raw";
import infantrySvgSource from "../../../assets/icons/nato/infantry.svg?raw";
import type {
  FactionDefinition,
  FactionId,
  CityDefinition,
  CityId,
  MoveOrder,
  TerritoryId,
  TerritoryControl,
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
import {
  clampMapCamera,
  initialMapCamera,
  mapCameraConfig,
  mapSemanticLevel,
  panMapCamera,
  renderedMapScale,
  zoomMapCamera,
  type MapCamera
} from "./mapCamera";
import {
  compactUnitStrength,
  mapAssetCompensation,
  mapKeyboardIntent,
  mapPresentationConfig,
  iberiaMapProjectionTransform,
  projectMapCoordinate,
  unitDesignation,
  unitMarkerPosition
} from "./mapPresentation";
import { WebGLTerrain } from "./WebGLTerrain";

interface IberiaMapProps {
  readonly cities?: readonly CityDefinition[];
  readonly cityControl?: Partial<Record<CityId, FactionId>>;
  readonly control: Record<TerritoryId, TerritoryControl>;
  readonly factions: readonly FactionDefinition[];
  readonly legalDestinationIds: readonly TerritoryId[];
  readonly onSelectTerritory: (territoryId: TerritoryId) => void;
  readonly onSelectUnit: (unitId: UnitId) => void;
  readonly plannedOrders?: readonly MoveOrder[];
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
  height: 225,
  width: 225,
  x: 238,
  y: 515
} as const;

const uncontrolledColor = "#d8c59d";
const overviewCityIds = new Set(["barcelona", "bilbao", "madrid", "seville", "valencia", "zaragoza"]);
const unitAnchorOverrides: Partial<Record<TerritoryId, { readonly x: number; readonly y: number }>> = {
  ceuta: { x: 337.7, y: 709.1 },
  melilla: { x: 368.6, y: 721.9 }
};

export function IberiaMap({
  cities = [],
  cityControl = {},
  control,
  factions,
  legalDestinationIds,
  onSelectTerritory,
  onSelectUnit,
  plannedOrders = [],
  resolutionOutcomes = [],
  selectedDestinationId,
  selectedFromTerritoryId,
  selectedUnitIds,
  units
}: IberiaMapProps): JSX.Element {
  const mapRef = useRef<HTMLDivElement>(null);
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const dragStart = useRef<{ pointerX: number; pointerY: number; view: MapCamera } | undefined>(undefined);
  const pinchStart = useRef<{
    centerX: number;
    centerY: number;
    distance: number;
    view: MapCamera;
  } | undefined>(undefined);
  const movedDuringPointer = useRef(false);
  const [view, setView] = useState<MapCamera>(initialMapCamera);
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
  const renderedScale = renderedMapScale(view);
  const semanticLevel = mapSemanticLevel(view.scale);
  const unitCompensation = mapAssetCompensation(
    renderedScale,
    mapPresentationConfig.unitCompensationExponent
  );

  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;

    const handleWheel = (event: globalThis.WheelEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      const bounds = map.getBoundingClientRect();
      setView((current) => zoomMapCamera(
        current,
        current.scale * Math.exp(-event.deltaY * 0.002),
        event.clientX - bounds.left,
        event.clientY - bounds.top,
        bounds
      ));
    };

    map.addEventListener("wheel", handleWheel, { passive: false });
    return () => map.removeEventListener("wheel", handleWheel);
  }, []);

  function selectTerritoryFromTarget(target: EventTarget | null): void {
    const territoryId = territoryIdFromTarget(target as Element);

    if (territoryId !== undefined) {
      onSelectTerritory(territoryId);
    }
  }

  function updateZoom(nextScale: number, clientX?: number, clientY?: number): void {
    const bounds = mapRef.current?.getBoundingClientRect();
    if (bounds === undefined) return;
    const focusX = clientX === undefined ? bounds.width / 2 : clientX - bounds.left;
    const focusY = clientY === undefined ? bounds.height / 2 : clientY - bounds.top;
    setView((current) => zoomMapCamera(current, nextScale, focusX, focusY, bounds));
  }

  function panBy(deltaX: number, deltaY: number): void {
    const bounds = mapRef.current?.getBoundingClientRect();
    if (bounds === undefined) return;
    setView((current) => panMapCamera(current, deltaX, deltaY, bounds));
  }

  /* v8 ignore start -- pointer capture and multi-touch are exercised in Playwright's browser integration suite */
  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if ((event.target as Element).closest(".map-zoom-controls, .nato-unit-counter") !== null) return;
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    movedDuringPointer.current = false;
    if (activePointers.current.size === 1) {
      dragStart.current = { pointerX: event.clientX, pointerY: event.clientY, view };
    } else if (activePointers.current.size === 2) {
      const [first, second] = [...activePointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number }
      ];
      pinchStart.current = {
        centerX: (first.x + second.x) / 2,
        centerY: (first.y + second.y) / 2,
        distance: Math.hypot(first.x - second.x, first.y - second.y),
        view
      };
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (!activePointers.current.has(event.pointerId)) return;
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const bounds = mapRef.current?.getBoundingClientRect();
    if (bounds === undefined) return;

    if (activePointers.current.size === 2 && pinchStart.current !== undefined) {
      const [first, second] = [...activePointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number }
      ];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      const start = pinchStart.current;
      const nextScale = start.view.scale * (distance / Math.max(start.distance, 1));
      setView(zoomMapCamera(
        start.view,
        nextScale,
        start.centerX - bounds.left,
        start.centerY - bounds.top,
        bounds
      ));
      movedDuringPointer.current = true;
      return;
    }

    const start = dragStart.current;
    if (activePointers.current.size === 1 && start !== undefined) {
      const deltaX = event.clientX - start.pointerX;
      const deltaY = event.clientY - start.pointerY;
      if (Math.hypot(deltaX, deltaY) > 4) {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        movedDuringPointer.current = true;
      }
      setView(clampMapCamera(
        { ...start.view, x: start.view.x + deltaX, y: start.view.y + deltaY },
        bounds
      ));
    }
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>): void {
    activePointers.current.delete(event.pointerId);
    pinchStart.current = undefined;
    const remaining = [...activePointers.current.values()][0];
    dragStart.current = remaining === undefined
      ? undefined
      : { pointerX: remaining.x, pointerY: remaining.y, view };
  }
  /* v8 ignore stop */

  return (
    <section className="iberia-map-section">
      <div
        aria-describedby="iberia-map-instructions"
        aria-keyshortcuts="W A S D ArrowUp ArrowDown ArrowLeft ArrowRight + - 0"
        aria-label="Iberia campaign map"
        className={legalDestinationIds.length > 0 ? "iberia-map iberia-map-choosing-destination" : "iberia-map"}
        data-semantic-level={semanticLevel}
        onClick={(event: MouseEvent<HTMLDivElement>) => {
          if (movedDuringPointer.current) {
            movedDuringPointer.current = false;
            return;
          }
          selectTerritoryFromTarget(event.target);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          const intent = mapKeyboardIntent(event.key);
          if (intent === undefined) return;
          event.preventDefault();
          switch (intent.kind) {
            case "select":
              selectTerritoryFromTarget(event.target);
              break;
            case "pan":
              panBy(intent.deltaX, intent.deltaY);
              break;
            case "zoom-in":
              updateZoom(view.scale + mapCameraConfig.zoomStep);
              break;
            case "zoom-out":
              updateZoom(view.scale - mapCameraConfig.zoomStep);
              break;
            case "reset":
              setView(initialMapCamera);
          }
        }}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        ref={mapRef}
        role="group"
        style={mapColors}
        tabIndex={0}
      >
        <span className="visually-hidden" id="iberia-map-instructions">
          Drag or use W A S D to pan. Pinch, scroll, or use plus and minus to zoom. Press zero to reset the view.
        </span>
        <div
          className="iberia-map-viewport"
          data-camera-x={Math.round(view.x)}
          data-camera-y={Math.round(view.y)}
          style={{
            "--map-scale": renderedScale,
            "--unit-compensation": unitCompensation,
            transform: `translate(${view.x}px, ${view.y}px) scale(${renderedScale})`
          } as CSSProperties}
        >
          <div className="campaign-board">
            <span aria-hidden="true" className="campaign-board-notepad" />
            <span aria-hidden="true" className="campaign-board-pencil" />
            <span aria-hidden="true" className="campaign-board-cigar" />
            <div className="iberia-map-surface">
              <div className="iberia-map-plane">
                <WebGLTerrain />
                <div className="iberia-map-art" dangerouslySetInnerHTML={{ __html: mapMarkup }} />
                <MapOverlay cities={cities} cityControl={cityControl} factions={factions} mapScale={renderedScale} outcomes={resolutionOutcomes} plannedOrders={plannedOrders} />
                {positionedUnits.map(({ stackIndex, unit }) => (
                  <NatoUnitCounter
                    faction={factionById(factions, unit.factionId)}
                    hasOrder={plannedOrders.some((order) => order.unitId === unit.id)}
                    isSelected={selectedUnitIds.includes(unit.id)}
                    key={unit.id}
                    onSelectUnit={onSelectUnit}
                    stackIndex={stackIndex}
                    unit={unit}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="map-zoom-controls" aria-label="Map zoom controls" role="group">
          <button aria-label="Zoom out" disabled={view.scale <= mapCameraConfig.minScale} onClick={() => updateZoom(view.scale - mapCameraConfig.zoomStep)} type="button">−</button>
          <button aria-label="Reset map view" onClick={() => setView(initialMapCamera)} type="button">{Math.round(view.scale * 100)}%</button>
          <button aria-label="Zoom in" disabled={view.scale >= mapCameraConfig.maxScale} onClick={() => updateZoom(view.scale + mapCameraConfig.zoomStep)} type="button">+</button>
        </div>
        <span aria-live="polite" className="visually-hidden">Map zoom {Math.round(view.scale * 100)} percent</span>
      </div>
      <MapLegend factions={factions} />
    </section>
  );
}

interface MapOverlayProps {
  readonly cities: readonly CityDefinition[];
  readonly cityControl: Partial<Record<CityId, FactionId>>;
  readonly factions: readonly FactionDefinition[];
  readonly mapScale: number;
  readonly outcomes: readonly TurnOutcome[];
  readonly plannedOrders: readonly MoveOrder[];
}

function MapOverlay({ cities, cityControl, factions, mapScale, outcomes, plannedOrders }: MapOverlayProps): JSX.Element {
  const featuredRegions = Object.entries(iberiaRegions).filter(([, region]) => region.showLabel);
  const labelCompensation = mapAssetCompensation(
    mapScale,
    mapPresentationConfig.labelCompensationExponent
  );

  return (
    <svg
      aria-hidden="true"
      className="iberia-map-overlay"
      viewBox={`${mapViewBox.x} ${mapViewBox.y} ${mapViewBox.width} ${mapViewBox.height}`}
    >
      <defs>
        <marker id="iberia-arrowhead" markerHeight="5" markerWidth="5" orient="auto" refX="4" refY="2.5">
          <path d="M 0 0 L 5 2.5 L 0 5 Z" fill="#75cbd4" />
        </marker>
      </defs>
      <MapCountryLabel label="Portugal" mapScale={mapScale} x={300} y={630.5} />
      <MapCountryLabel label="France" mapScale={mapScale} x={406.8} y={520.9} />
      <MapCountryLabel label="Morocco" mapScale={mapScale} x={403} y={727} />
      {featuredRegions.map(([regionId, region]) => (
        <MapRegionLabel key={regionId} mapScale={mapScale} region={region} />
      ))}
      {cities.map((city) => (
        <MapCity
          city={city}
          controller={cityControl[city.id]}
          factions={factions}
          key={city.id}
          labelCompensation={labelCompensation}
        />
      ))}
      <OrderAnnotations mapScale={mapScale} outcomes={outcomes} plannedOrders={plannedOrders} />
    </svg>
  );
}

function MapCity({
  city,
  controller,
  factions,
  labelCompensation
}: {
  readonly city: CityDefinition;
  readonly controller: FactionId | undefined;
  readonly factions: readonly FactionDefinition[];
  readonly labelCompensation: number;
}): JSX.Element {
  const position = projectMapCoordinate(city);
  return (
    <g
      className={overviewCityIds.has(city.id) ? "map-city" : "map-city map-city-secondary"}
      transform={`translate(${position.x} ${position.y}) scale(${labelCompensation})`}
    >
      <circle fill={cityColor(controller, factions)} r="1.8" />
      <text textAnchor={position.x > 410 ? "end" : "start"} x={position.x > 410 ? -3 : 3} y="1.4">{city.name}</text>
    </g>
  );
}

function MapCountryLabel({ label, mapScale, project = false, x, y }: { readonly label: string; readonly mapScale: number; readonly project?: boolean; readonly x: number; readonly y: number }): JSX.Element {
  const compensation = mapAssetCompensation(
    mapScale,
    mapPresentationConfig.labelCompensationExponent
  );
  const position = project ? projectMapCoordinate({ x, y }) : { x, y };

  return (
    <g className="iberia-country-label" transform={`translate(${position.x} ${position.y}) scale(${compensation})`}>
      <text textAnchor="middle">{label}</text>
    </g>
  );
}

function MapRegionLabel({ mapScale, region }: { readonly mapScale: number; readonly region: IberiaRegion }): JSX.Element {
  const width = Math.max(19, region.name.length * 2.8);
  const position = projectMapCoordinate(region.anchor);
  const x = position.x;
  const y = position.y - 13;
  const compensation = mapAssetCompensation(
    mapScale,
    mapPresentationConfig.labelCompensationExponent
  );

  return (
    <g className="iberia-region-label" transform={`translate(${x} ${y}) scale(${compensation})`}>
      <rect height="7" rx="1.4" width={width} x={width / -2} y="-5" />
      <text textAnchor="middle" x="0" y="0">
        {region.name}
      </text>
    </g>
  );
}

interface OrderAnnotationsProps {
  readonly mapScale: number;
  readonly outcomes: readonly TurnOutcome[];
  readonly plannedOrders: readonly MoveOrder[];
}

function OrderAnnotations({ mapScale, outcomes, plannedOrders }: OrderAnnotationsProps): JSX.Element {
  return (
    <g className="map-annotations">
      {plannedOrders.map((order) => {
        const from = projectMapCoordinate(territoryAnchors[order.from]);
        const to = projectMapCoordinate(territoryAnchors[order.to]);
        return (
          <line
            className="map-planned-order-arrow"
            key={`${order.unitId}-planned`}
            markerEnd="url(#iberia-arrowhead)"
            x1={from.x}
            x2={to.x}
            y1={from.y}
            y2={to.y}
          />
        );
      })}
      {outcomes.flatMap((outcome) => {
        if (outcome.kind === "no-move" || outcome.kind === "invalid-order") {
          return [];
        }

        const from = projectMapCoordinate(territoryAnchors[outcome.order.from]);
        const to = projectMapCoordinate(territoryAnchors[outcome.order.to]);
        const midpoint = {
          x: (from.x + to.x) / 2,
          y: (from.y + to.y) / 2
        };

        return [
          <line
            className="map-order-arrow"
            key={`${outcome.order.unitId}-arrow`}
            markerEnd="url(#iberia-arrowhead)"
            x1={from.x}
            x2={to.x}
            y1={from.y}
            y2={to.y}
          />,
          outcome.kind === "bounced-move" ? <BounceMarker key={`${outcome.order.unitId}-bounce`} mapScale={mapScale} x={midpoint.x} y={midpoint.y} /> : null,
          outcome.kind === "disbanded-move" ? <DisbandMarker key={`${outcome.order.unitId}-disband`} mapScale={mapScale} x={midpoint.x} y={midpoint.y} /> : null
        ];
      })}
    </g>
  );
}

function BounceMarker({ mapScale, x, y }: { readonly mapScale: number; readonly x: number; readonly y: number }): JSX.Element {
  return (
    <g className="map-outcome-icon map-bounce-icon" transform={`translate(${x} ${y}) scale(${mapAssetCompensation(mapScale, 1)})`}>
      <circle r="4.5" />
      <path d="M -2.8 -1 L -0.4 -1 L -1.6 -2.2 M 2.8 1 L 0.4 1 L 1.6 2.2" />
    </g>
  );
}

function DisbandMarker({ mapScale, x, y }: { readonly mapScale: number; readonly x: number; readonly y: number }): JSX.Element {
  return (
    <g className="map-outcome-icon map-disband-icon" transform={`translate(${x} ${y}) scale(${mapAssetCompensation(mapScale, 1)})`}>
      <path d="M 0 -5 L 1.4 -2.7 L 4 -3.5 L 3.2 -0.9 L 5 1 L 2.3 1.5 L 1.5 4.2 L 0 2.2 L -1.5 4.2 L -2.3 1.5 L -5 1 L -3.2 -0.9 L -4 -3.5 L -1.4 -2.7 Z" />
      <path d="M -1.8 -1.8 L 1.8 1.8 M 1.8 -1.8 L -1.8 1.8" />
    </g>
  );
}

interface NatoUnitCounterProps {
  readonly faction: FactionDefinition;
  readonly hasOrder: boolean;
  readonly isSelected: boolean;
  readonly onSelectUnit: (unitId: UnitId) => void;
  readonly stackIndex: number;
  readonly unit: UnitState;
}

function NatoUnitCounter({
  faction,
  hasOrder,
  isSelected,
  onSelectUnit,
  stackIndex,
  unit
}: NatoUnitCounterProps): JSX.Element {
  const iconMarkup = useMemo(() => prepareNatoIconMarkup(infantrySvgSource, faction.color), [faction.color]);
  const anchor = unitAnchorOverrides[unit.territoryId]
    ?? projectMapCoordinate(territoryAnchors[unit.territoryId]);
  const markerPosition = unitMarkerPosition(anchor, stackIndex, mapViewBox);
  const classNames = [
    "nato-unit-counter",
    isSelected ? "nato-unit-counter-selected" : "",
    hasOrder ? "nato-unit-counter-ordered" : ""
  ].filter(Boolean).join(" ");
  const designation = unitDesignation(unit.displayName);

  return (
    <button
      aria-label={`${unit.displayName}, strength ${unit.strength}${hasOrder ? ", order assigned" : ""}`}
      className={classNames}
      disabled={hasOrder}
      onClick={(event) => {
        event.stopPropagation();
        onSelectUnit(unit.id);
      }}
      style={{
        "--faction-color": faction.color,
        left: `${markerPosition.leftPercent}%`,
        top: `${markerPosition.topPercent}%`
      } as CSSProperties}
      type="button"
    >
      <span className="nato-unit-designation" aria-hidden="true">{designation}</span>
      <span className="nato-unit-symbol" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconMarkup }} />
      <span className="nato-unit-strength" aria-hidden="true">{compactUnitStrength(unit.strength)}</span>
      <span className="nato-unit-abbreviation">{faction.abbreviation}</span>
      {hasOrder ? <span className="nato-unit-order-badge" aria-hidden="true">✓</span> : null}
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
        <span className="map-legend-swatch map-legend-contested" />
        Contested in the historical snapshot
      </li>
      <li>
        <span className="map-legend-swatch map-legend-portugal" />
        Neutral surroundings
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
  documentNode.querySelector("#map-group")?.setAttribute("transform", iberiaMapProjectionTransform);
  documentNode.querySelector("#legend-svg")?.remove();
  documentNode.querySelector("#credit-text-svg")?.remove();
  documentNode.querySelector("#sidemap")?.remove();
  documentNode.querySelectorAll("script, foreignObject").forEach((element) => element.remove());

  Object.entries(iberiaRegions).forEach(([regionId, region]) => {
    const regionElement = documentNode.getElementById(regionId) as unknown as SVGElement | null;
    if (regionElement === null) return;

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

  for (const insetId of ["ES63", "ES64", "ES70", "PT20", "PT30", "Gibraltar"]) {
    documentNode.getElementById(insetId)?.remove();
  }

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
  control: TerritoryControl | undefined,
  factions: readonly FactionDefinition[]
): string {
  if (control === undefined) return uncontrolledColor;
  if (control.kind === "controlled") return factionById(factions, control.factionId).color;
  return "#9a7e69";
}

function cityColor(controller: FactionId | undefined, factions: readonly FactionDefinition[]): string {
  return controller === undefined ? uncontrolledColor : factionById(factions, controller).color;
}

function territoryIdFromTarget(target: Element): TerritoryId | undefined {
  const regionId = target.closest("[data-region-id]")?.getAttribute("data-region-id");

  return regionId === null || regionId === undefined ? undefined : regionById(regionId)?.territoryId ?? undefined;
}

function factionById(factions: readonly FactionDefinition[], factionId: FactionId): FactionDefinition {
  return factions.find((candidate) => candidate.id === factionId) as FactionDefinition;
}
