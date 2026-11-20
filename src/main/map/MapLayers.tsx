import type { GameState } from "../engine/types";
import { territoryName } from "../presentation/text";
import type { MapPackage, MapPoint, MapRect, ScenarioPackage } from "../scenarios/loader";
import type { MapAssets } from "../scenarios/registry";
import { CounterLayer, layoutCounters } from "./CounterLayer";
import { weatherIn } from "../engine/weather";
import { DestinationOddsLayer } from "./DestinationOddsLayer";
import { AirLayer, placeAircraft, withoutAircraft } from "./layers/AirLayer";
import { BattleIconLayer } from "./BattleIconLayer";
import { battleMarkPoints } from "./RouteLayer";
import { destinationTags, RailLayer } from "./layers/RailLayer";
import type { MapLayerProps } from "./layers/slots";
import { SubTerritoryLayer, SubTerritoryWash } from "./layers/SubTerritoryLayer";
import { mapControlObstacles } from "./MapControls";
import type { PaneLayout } from "./MapPane";
import { TerrainLayer } from "./TerrainLayer";
import { VectorLayer } from "./VectorLayer";
import { mapTerritory, territoryAnchor } from "./anchors";
import { type Camera, type CameraBounds, type Viewport, mapToScreen, pixelsPerUnit, semanticLevel, visibleRect } from "./camera";
import type { PreparedGeometry } from "./markup";
import { type ScreenRect, visibleContextLabels } from "./placement";
import { highlightedTerritoryId, type MapView } from "./view";
import { visibleWater } from "./waterLabels";
import type { JSX } from "react";

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

export function MapLayers({ assets, bounds, camera, game, geometry, layout, level, onTerrainFallback, scenarioPackage, view, viewport }: MapLayersProps): JSX.Element {
  const { map, scenario } = scenarioPackage;
  const scale = pixelsPerUnit(camera, viewport, bounds);
  const visible = visibleRect(camera, viewport, bounds);
  const toScreen = (point: { readonly x: number; readonly y: number }) => mapToScreen(point, camera, viewport, bounds);
  const place = (rect: MapRect): MapRect => ({ ...toScreen(rect), height: rect.height * scale, width: rect.width * scale });
  const landLabels = labelObstacles(scenarioPackage, level, toScreen, viewport.height, layout);
  const expandedTerritoryId = highlightedTerritoryId(view);
  // U2 (m3r1-air-generals): aircraft are drawn by the air layer at their airfields, not as army counters.
  const groundGame = withoutAircraft(scenario, game);
  // B1: aircraft are placed first, clear of the names, and the army counters are laid out around them.
  const air = placeAircraft(scenarioPackage, game, toScreen, landLabels, stackSpots(groundGame, map, toScreen));
  const counterLayout = layoutCounters(groundGame, map, camera.zoom, toScreen, [...landLabels, ...air.rects], {
    ...(expandedTerritoryId === undefined ? {} : { expandedTerritoryId }),
    narrow: layout === "sheet"
  });
  const { height, width } = counterLayout.metrics;
  const counters = [...counterLayout.positions.values()].map((position) => ({ ...position, height, width }));
  const layerProps: MapLayerProps = { game, level, scenarioPackage, toScreen, unitSymbols: assets.unitSymbols, view };

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
      {/* X2: the sub-territory wash sits under the vector layer's borders, rivers, cities and names. */}
      <SubTerritoryWash {...layerProps} />
      <VectorLayer
        contextLabels={visibleContextLabels(map.contextLabels, toScreen, viewport, counters)}
        game={game}
        geometry={geometry}
        level={level}
        map={map}
        scenario={scenario}
        underlay={<RailLayer {...layerProps} narrow={layout === "sheet"} />}
        unit={1 / scale}
        view={view}
        visible={visible}
        water={visibleWater(map, {
          level,
          // landLabels already holds the fixed controls and legend for this layout.
          obstacles: [...counters, ...air.rects, ...landLabels],
          scale,
          toScreen,
          // The open pane floats 0.75rem in from the edge, so names keep clear of its full width.
          viewport: { height: viewport.height - viewport.insetBottom, width: viewport.width - viewport.insetRight - (viewport.insetRight > 0 ? 12 : 0) }
        })}
      />
      {/* Milestone 3 layers, between the map and the counters: sub-territories (rail is in the vector layer's underlay). */}
      <SubTerritoryLayer {...layerProps} />
      <CounterLayer
        game={groundGame}
        layout={counterLayout}
        level={level}
        scenario={scenario}
        unitSymbols={assets.unitSymbols}
        view={view}
      />
      <AirLayer {...layerProps} placements={air.placements} />
      <BattleIconLayer
        marks={battleMarkPoints(view, scenario, (id) => territoryAnchor(map, id), 1 / scale)}
        onSelectTerritory={view.onSelectTerritory}
        scenario={scenario}
        toScreen={toScreen}
      />
      {view.destinationEstimates === undefined ? null : (
        <DestinationOddsLayer counters={[...counters, ...air.rects]} estimates={view.destinationEstimates} labelAt={(id) => toScreen(mapTerritory(map, id).label)} tags={destinationTags(scenario, game, view)} weatherAt={(id) => weatherIn(scenario, game, id)?.id} />
      )}
    </>
  );
}

/** Where each territory's army stack is first placed: under its anchor, about one compact counter. */
function stackSpots(game: GameState, map: MapPackage, toScreen: (point: MapPoint) => MapPoint): readonly ScreenRect[] {
  const territories = new Set(Object.values(game.units).map((unit) => unit.territoryId));
  return [...territories].map((id) => {
    const anchor = toScreen(territoryAnchor(map, id));
    return { height: 30, width: 56, x: anchor.x - 28, y: anchor.y };
  });
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
