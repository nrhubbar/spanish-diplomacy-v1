import { type JSX, useCallback, useMemo, useState } from "react";
import type { GameState } from "../engine/types";
import type { MapRect, ScenarioPackage } from "../scenarios/loader";
import type { MapAssets } from "../scenarios/registry";
import { glyphs } from "../presentation/glyphs";
import { cssVariables } from "../presentation/style";
import { territoryName } from "../presentation/text";
import { type Camera, type CameraBounds, cameraLimits, type Viewport, mapToScreen, pixelsPerUnit, semanticLevel, visibleRect } from "./camera";
import { CounterLayer, counterMetrics, layoutCounters } from "./CounterLayer";
import { MapLegend } from "./MapLegend";
import { MapPane, type PaneContent, paneLayoutFor, paneWidthFor, sheetBarHeight } from "./MapPane";
import { prepareGeometry, type PreparedGeometry } from "./markup";
import { type ScreenRect, visibleContextLabels } from "./placement";
import { TerrainLayer } from "./TerrainLayer";
import { useMapCamera } from "./useMapCamera";
import { VectorLayer } from "./VectorLayer";
import type { MapView } from "./view";

interface CampaignMapProps {
  readonly assets: MapAssets;
  readonly game: GameState;
  readonly onTerrainFallback?: (reason: string) => void;
  readonly pane?: PaneContent;
  readonly scenarioPackage: ScenarioPackage;
  readonly view: MapView;
}

/** Map package interpreter: terrain, vector geometry, counters, controls, and the details pane. */
export function CampaignMap({ assets, game, onTerrainFallback, pane, scenarioPackage, view }: CampaignMapProps): JSX.Element {
  const { map, scenario } = scenarioPackage;
  // undefined = follow the layout default: open as a side pane, collapsed as a mobile sheet.
  const [paneChoice, setPaneChoice] = useState<boolean | undefined>(undefined);
  const hasPane = pane !== undefined;
  const insetsFor = useCallback((width: number) => {
    const layoutHere = paneLayoutFor(width);
    const openHere = paneChoice ?? layoutHere === "side";
    if (!hasPane) return { bottom: 0, right: 0 };
    return layoutHere === "side"
      ? { bottom: 0, right: openHere ? paneWidthFor(width) : 0 }
      : { bottom: sheetBarHeight, right: 0 };
  }, [hasPane, paneChoice]);
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
  } = useMapCamera(bounds, insetsFor, selectFrom);
  const layout = paneLayoutFor(viewport.width);
  const paneWidth = paneWidthFor(viewport.width);
  const sheetFocused = layout === "sheet" && pane?.sheetFocus !== undefined;
  const paneOpen = !sheetFocused && (paneChoice ?? layout === "side");
  const attention = pane?.attentionKey;
  const [seenAttention, setSeenAttention] = useState(attention);
  if (attention !== seenAttention) {
    // A new selection or message opens a collapsed pane so the player sees the response.
    setSeenAttention(attention);
    if (attention !== undefined && paneChoice !== true) setPaneChoice(true);
  }


  const level = semanticLevel(camera.zoom);

  return (
    <section
      aria-label="Campaign map"
      className="campaign-map"
      data-pane-layout={layout}
      data-pane-open={pane !== undefined && paneOpen}
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
            level={level}
            onTerrainFallback={onTerrainFallback}
            scenarioPackage={scenarioPackage}
            view={view}
            viewport={viewport}
          />
        ) : null}
      </div>
      <div className="map-zoom" data-map-control="" role="group" aria-label="Zoom">
        <button aria-label="Zoom in" disabled={(camera.zoom) >= cameraLimits.maxZoom} onClick={() => { zoomBy(cameraLimits.zoomStep); }} type="button">+</button>
        <button aria-label={`${String(Math.round(camera.zoom * 100))}%, reset map view`} className="map-zoom-level" onClick={reset} type="button">{`${String(Math.round((camera.zoom) * 100))}%`}</button>
        <button aria-label="Zoom out" disabled={(camera.zoom) <= cameraLimits.minZoom} onClick={() => { zoomBy(-cameraLimits.zoomStep); }} type="button">{glyphs.minus}</button>
      </div>
      <span aria-live="polite" className="visually-hidden">{`Map zoom ${String(Math.round((camera.zoom) * 100))} percent`}</span>
      <MapLegend game={game} scenario={scenario} view={view} />
      {/* The pane waits for measurement so it never flashes in the wrong layout. */}
      {pane === undefined || !measured ? null : (
        <MapPane content={pane} layout={layout} onToggle={() => { setPaneChoice(!paneOpen); }} open={paneOpen} />
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
  readonly level: ReturnType<typeof semanticLevel>;
  readonly onTerrainFallback: ((reason: string) => void) | undefined;
  readonly scenarioPackage: ScenarioPackage;
  readonly view: MapView;
  readonly viewport: Viewport;
}

function MapLayers({ assets, bounds, camera, game, geometry, level, onTerrainFallback, scenarioPackage, view, viewport }: MapLayersProps): JSX.Element {
  const { map, scenario } = scenarioPackage;
  const scale = pixelsPerUnit(camera, viewport, bounds);
  const visible = visibleRect(camera, viewport, bounds);
  const toScreen = (point: { readonly x: number; readonly y: number }) => mapToScreen(point, camera, viewport, bounds);
  const place = (rect: MapRect): MapRect => ({ ...toScreen(rect), height: rect.height * scale, width: rect.width * scale });
  const positions = layoutCounters(game, map, level, toScreen, labelObstacles(scenarioPackage, level, toScreen, viewport.height));
  const { height, width } = counterMetrics[level];
  const counters = [...positions.values()].map((position) => ({ ...position, height, width }));

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
      />
      <CounterLayer
        game={game}
        level={level}
        positions={positions}
        scenario={scenario}
        unitSymbols={assets.unitSymbols}
        view={view}
      />
    </>
  );
}

/** Screen rectangles counters should avoid: visible labels and the fixed map controls (V4, V7). */
function labelObstacles(
  { map, scenario }: ScenarioPackage,
  level: ReturnType<typeof semanticLevel>,
  toScreen: (point: { readonly x: number; readonly y: number }) => { readonly x: number; readonly y: number },
  height: number
): readonly ScreenRect[] {
  const rects: ScreenRect[] = [
    { height: 132, width: 58, x: 0, y: 0 },
    { height: 46, width: 120, x: 0, y: height - 46 }
  ];
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
