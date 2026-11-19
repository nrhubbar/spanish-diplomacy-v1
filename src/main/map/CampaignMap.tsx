import { type JSX, useCallback, useMemo } from "react";
import type { GameState } from "../engine/types";
import type { MapRect, ScenarioPackage } from "../scenarios/loader";
import type { MapAssets } from "../scenarios/registry";
import { cssVariables } from "../presentation/style";
import { territoryName } from "../presentation/text";
import { type Camera, type CameraBounds, type Viewport, mapToScreen, pixelsPerUnit, semanticLevel, visibleRect } from "./camera";
import { CounterLayer, layoutCounters } from "./CounterLayer";
import { DestinationOddsLayer } from "./DestinationOddsLayer";
import { mapTerritory } from "./anchors";
import { MapLegend } from "./MapLegend";
import { mapControlObstacles, MapControls } from "./MapControls";
import { MapPane, type PaneContent, type PaneLayout, paneLayoutFor, paneWidthFor } from "./MapPane";
import { prepareGeometry, type PreparedGeometry } from "./markup";
import { type ScreenRect, visibleContextLabels } from "./placement";
import { TerrainLayer } from "./TerrainLayer";
import { useMapCamera } from "./useMapCamera";
import { type MapBriefing, usePaneView } from "./usePaneView";
import { VectorLayer } from "./VectorLayer";
import { visibleWater } from "./waterLabels";
import type { MapView } from "./view";

interface CampaignMapProps {
  readonly assets: MapAssets;
  readonly briefing?: MapBriefing;
  readonly game: GameState;
  readonly onTerrainFallback?: (reason: string) => void;
  readonly pane?: PaneContent;
  readonly scenarioPackage: ScenarioPackage;
  readonly view: MapView;
}

/** Map package interpreter: terrain, vector geometry, counters, controls, and the details pane. */
export function CampaignMap({ assets, briefing, game, onTerrainFallback, pane, scenarioPackage, view }: CampaignMapProps): JSX.Element {
  const { map, scenario } = scenarioPackage;
  const paneView = usePaneView(pane, briefing);
  const bounds = useMemo<CameraBounds>(() => ({ content: map.viewBox, focus: map.focus }), [map]);
  const geometry = useMemo(
    () => prepareGeometry(assets.geometrySvg, map, (id) => territoryName(scenario, id)),
    [assets.geometrySvg, map, scenario]
  );

  const selectFrom = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return;
    const value = target.closest("[data-territory-id]")?.getAttribute("data-territory-id");
    const territory = scenario.territories.find((candidate) => candidate.id === value);
    if (territory !== undefined) view.onSelectTerritory?.(territory.id);
  }, [scenario, view]);

  const {
    camera,
    consumeDrag,
    containerRef,
    onKeyDown,
    onPointerCancel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    measured,
    reset,
    viewport,
    zoomBy
  } = useMapCamera(bounds, paneView.insetsFor, selectFrom);
  const layout = paneLayoutFor(viewport.width);
  const paneWidth = paneWidthFor(viewport.width);
  const paneOpen = paneView.isOpen(layout);
  const paneContent = paneView.content;
  const level = semanticLevel(camera.zoom);

  return (
    <section
      aria-label="Campaign map"
      className="campaign-map"
      data-pane-layout={layout}
      data-pane-open={paneContent !== undefined && paneOpen}
      style={cssVariables({ "--map-background": map.background, "--pane-width": `${String(paneWidth)}px` })}
    >
      <div
        aria-describedby="map-instructions"
        aria-keyshortcuts="W A S D ArrowUp ArrowDown ArrowLeft ArrowRight + - 0"
        className="map-surface"
        data-camera-x={camera.centerX.toFixed(1)}
        data-semantic-level={level}
        data-zoom={camera.zoom.toFixed(2)}
        onClick={(event) => {
          if (!consumeDrag()) selectFrom(event.target);
        }}
        onKeyDown={onKeyDown}
        onPointerCancel={onPointerCancel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={containerRef}
        role="application"
        aria-roledescription="map"
        aria-label={`${scenario.name} map`}
        tabIndex={0}
      >
        <span className="visually-hidden" id="map-instructions">
          Drag or use W, A, S, and D to pan. Scroll, pinch, or use plus and minus to zoom. Press zero to reset the view.
          Tab to a territory and press Enter to select it.
        </span>
        {measured ? (
          <MapLayers
            assets={assets}
            bounds={bounds}
            camera={camera}
            game={game}
            geometry={geometry}
            layout={layout}
            level={level}
            onTerrainFallback={onTerrainFallback}
            scenarioPackage={scenarioPackage}
            view={view}
            viewport={viewport}
          />
        ) : null}
      </div>
      <MapControls
        {...(briefing === undefined ? {} : { briefing: { onToggle: () => { paneView.toggleBriefing(paneOpen); }, shown: paneView.briefingShown } })}
        onReset={reset}
        onZoom={zoomBy}
        zoom={camera.zoom}
      />
      <MapLegend game={game} scenario={scenario} view={view} />
      {/* The pane waits for measurement so it never flashes in the wrong layout. */}
      {paneContent === undefined || !measured ? null : (
        <MapPane content={paneContent} layout={layout} onToggle={() => { paneView.togglePane(paneOpen); }} open={paneOpen} />
      )}
    </section>
  );
}

interface MapLayersProps {
  readonly assets: MapAssets;
  readonly bounds: CameraBounds;
  readonly camera: Camera;
  readonly game: GameState;
  readonly geometry: PreparedGeometry;
  readonly layout: PaneLayout;
  readonly level: ReturnType<typeof semanticLevel>;
  readonly onTerrainFallback: ((reason: string) => void) | undefined;
  readonly scenarioPackage: ScenarioPackage;
  readonly view: MapView;
  readonly viewport: Viewport;
}

function MapLayers({ assets, bounds, camera, game, geometry, layout, level, onTerrainFallback, scenarioPackage, view, viewport }: MapLayersProps): JSX.Element {
  const { map, scenario } = scenarioPackage;
  const scale = pixelsPerUnit(camera, viewport, bounds);
  const visible = visibleRect(camera, viewport, bounds);
  const toScreen = (point: { readonly x: number; readonly y: number }) => mapToScreen(point, camera, viewport, bounds);
  const place = (rect: MapRect): MapRect => ({ ...toScreen(rect), height: rect.height * scale, width: rect.width * scale });
  const landLabels = labelObstacles(scenarioPackage, level, toScreen, viewport.height, layout);
  const counterLayout = layoutCounters(game, map, level, toScreen, landLabels, {
    ...(view.selectedTerritoryId === undefined ? {} : { expandedTerritoryId: view.selectedTerritoryId }),
    narrow: layout === "sheet"
  });
  const { height, width } = counterLayout.metrics;
  const counters = [...counterLayout.positions.values()].map((position) => ({ ...position, height, width }));

  return (
    <>
      {assets.terrain === undefined ? null : (
        <TerrainLayer
          layers={assets.terrain.layers}
          onFallback={(reason) => { onTerrainFallback?.(reason); }}
          place={place}
          visible={visible}
        />
      )}
      <VectorLayer
        contextLabels={visibleContextLabels(map.contextLabels, toScreen, viewport, counters)}
        game={game}
        geometry={geometry}
        level={level}
        map={map}
        scenario={scenario}
        unit={1 / scale}
        view={view}
        visible={visible}
        water={visibleWater(map, {
          level,
          // landLabels already holds the fixed controls and legend for this layout.
          obstacles: [...counters, ...landLabels],
          scale,
          toScreen,
          // The open pane floats 0.75rem in from the edge, so names keep clear of its full width.
          viewport: { height: viewport.height - viewport.insetBottom, width: viewport.width - viewport.insetRight - (viewport.insetRight > 0 ? 12 : 0) }
        })}
      />
      <CounterLayer
        game={game}
        layout={counterLayout}
        level={level}
        scenario={scenario}
        unitSymbols={assets.unitSymbols}
        view={view}
      />
      {view.destinationEstimates === undefined ? null : (
        <DestinationOddsLayer counters={counters} estimates={view.destinationEstimates} labelAt={(id) => toScreen(mapTerritory(map, id).label)} />
      )}
    </>
  );
}

/** Screen rectangles counters should avoid: visible labels and the fixed map controls (V4, V7). */
function labelObstacles(
  { map, scenario }: ScenarioPackage,
  level: ReturnType<typeof semanticLevel>,
  toScreen: (point: { readonly x: number; readonly y: number }) => { readonly x: number; readonly y: number },
  height: number,
  layout: PaneLayout
): readonly ScreenRect[] {
  const rects: ScreenRect[] = [...mapControlObstacles(layout, height)];
  for (const city of scenario.cities) {
    const position = map.cities.get(city.id);
    if (position === undefined || (position.tier === "detail" && level === "overview")) continue;
    const point = toScreen(position);
    rects.push({ height: 15, width: city.name.length * 6.6 + 10, x: point.x - 4, y: point.y - 9 });
  }
  for (const [territoryId, entry] of map.territories) {
    if (entry.label.tier === "detail" && level === "overview") continue;
    const name = territoryName(scenario, territoryId);
    const point = toScreen(entry.label);
    const width = name.length * 7.4;
    rects.push({ height: 16, width, x: point.x - width / 2, y: point.y - 12 });
  }
  return rects;
}
