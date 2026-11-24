import { unitKindIn } from "../engine/air/pieces";
import { compareIds } from "../engine/board";
import type { GameState, Scenario, UnitId, UnitState } from "../engine/types";
import type { MapPackage, MapPoint, ScenarioPackage } from "../scenarios/loader";
import { mapTerritory } from "./anchors";
import { semanticLevel } from "./camera";
import { armyItems, type CounterItem, groupedItems, itemUnits } from "./counterItems";
import { compactMetricsAt, type CounterLayout, counterMetrics, layoutCounters, type LayoutOptions } from "./CounterLayer";
import { type CounterMetrics, intersects, overlap, positionInStack, type ScreenRect, stackSize } from "./placement";

/** The board without its aircraft, for the army counters; the air layer draws aircraft. */
export function withoutAircraft(scenario: Scenario, game: GameState): GameState {
  const units = Object.fromEntries(Object.entries(game.units).filter(([id]) => unitKindIn(scenario, game.raised, id as UnitId) !== "air"));
  return Object.keys(units).length === Object.keys(game.units).length ? game : { ...game, units };
}

/** The board's aircraft alone, in a stable order. */
function onlyAircraft(scenario: Scenario, game: GameState): GameState {
  const aircraft = Object.values(game.units)
    .filter((unit) => unitKindIn(scenario, game.raised, unit.id) === "air")
    .sort((a, b) => compareIds(a.territoryId, b.territoryId) || compareIds(a.factionId, b.factionId) || compareIds(a.id, b.id));
  return { ...game, units: Object.fromEntries(aircraft.map((unit) => [unit.id, unit])) };
}

/** Where an airbase is drawn: the city of the faction's airfield sub-territory there, else the territory's label. */
function basePoint(scenario: Scenario, map: MapPackage, game: GameState, unit: UnitState): MapPoint {
  for (const sub of scenario.index.subTerritoriesByTerritory.get(unit.territoryId) ?? []) {
    if (game.subTerritories[sub.id]?.holder !== unit.factionId) continue;
    const airbase = (game.subTerritories[sub.id]?.buildings ?? []).some((id) =>
      scenario.index.buildings.get(id)?.effects.some((effect) => effect.kind === "airbase" || effect.kind === "all-weather-airbase") ?? false);
    const city = sub.cityIds.map((id) => map.cities.get(id)).find((point) => point !== undefined);
    if (airbase && city !== undefined) return city;
  }
  return mapTerritory(map, unit.territoryId).label;
}

/** How far an airfield's cards sit from its city's dot. */
const lift = 8;

/** Where one aircraft card, or one group of them, is drawn, in screen pixels. */
export interface AirPlacement {
  readonly base: MapPoint;
  readonly item: CounterItem;
  readonly position: MapPoint;
}

export interface AirLayout {
  readonly metrics: CounterMetrics;
  readonly placements: readonly AirPlacement[];
  /** The room each airfield's cards take. */
  readonly rects: readonly ScreenRect[];
}

export interface PieceLayoutOptions extends LayoutOptions {
  readonly zoom: number;
}

/**
 * D7: each faction's aircraft at an airfield as one block of cards, in the army counters' own
 * sizes, beside the airfield's city and clear of `obstacles` and of the other airfields' blocks.
 * Where the zoom always groups armies, aircraft group too, and the expanded territory shows its
 * own one by one. Grouping never depends on how the armies were laid out.
 */
export function placeAircraft(
  { map, scenario }: ScenarioPackage,
  game: GameState,
  toScreen: (point: MapPoint) => MapPoint,
  { expandedTerritoryId, narrow, zoom }: PieceLayoutOptions,
  obstacles: readonly ScreenRect[],
  /** The army counters' spots: kept clear when a spot allows, never at a name's expense. */
  preferClear: readonly ScreenRect[] = []
): AirLayout {
  const compact = compactMetricsAt(zoom, narrow);
  const metrics = compact ?? counterMetrics[semanticLevel(zoom)];
  const board = onlyAircraft(scenario, game);
  const blocks = new Map<string, { readonly base: MapPoint; readonly items: CounterItem[] }>();
  for (const item of compact === undefined ? armyItems(board) : groupedItems(board, expandedTerritoryId)) {
    const [unit] = itemUnits(item);
    if (unit === undefined) continue;
    const key = `${unit.territoryId}|${unit.factionId}`;
    const block = blocks.get(key) ?? { base: toScreen(basePoint(scenario, map, game, unit)), items: [] };
    block.items.push(item);
    blocks.set(key, block);
  }
  const placements: AirPlacement[] = [];
  const rects: ScreenRect[] = [];
  for (const { base, items } of blocks.values()) {
    const box = blockSpot(base, stackSize(items.length, metrics), metrics, [...obstacles, ...rects], preferClear);
    rects.push(box);
    items.forEach((item, index) => {
      placements.push({ base, item, position: positionInStack(box, index, items.length, metrics) });
    });
  }
  return { metrics, placements, rects };
}

/** Above the city first, so the armies keep the room under it; then around it, then further out. */
function blockSpot(
  base: MapPoint,
  { height, width }: { readonly height: number; readonly width: number },
  metrics: CounterMetrics,
  blocked: readonly ScreenRect[],
  preferClear: readonly ScreenRect[]
): ScreenRect {
  const above = base.y - lift - height;
  const beside = base.y - height / 2;
  const below = base.y + lift + 4;
  const left = base.x - width - lift;
  const centre = base.x - width / 2;
  const right = base.x + lift;
  const step = metrics.height / 2 + metrics.gap;
  const reach = metrics.width + metrics.gap;
  const spots: readonly MapPoint[] = [
    { x: centre, y: above }, { x: left, y: above }, { x: right, y: above },
    { x: left, y: beside }, { x: right, y: beside },
    { x: centre, y: below }, { x: left, y: below }, { x: right, y: below },
    // Crowded: further up, down and out to each side.
    ...[1, 2, 3].flatMap((rows) => [centre, left, right].flatMap((x) => [{ x, y: above - rows * step }, { x, y: below + rows * step }])),
    ...[1, 2].flatMap((out) => [above, beside, below].flatMap((y) => [{ x: left - out * reach, y }, { x: right + out * reach, y }]))
  ];
  const candidates = spots.map((spot): ScreenRect => ({ ...spot, height, width }));
  const clear = (avoid: readonly ScreenRect[]) => candidates.find((candidate) => !avoid.some((other) => intersects(candidate, other)));
  return clear([...blocked, ...preferClear]) ?? clear(blocked)
    ?? candidates.reduce((best, candidate) => (overlap(candidate, blocked) < overlap(best, blocked) ? candidate : best));
}

export interface PieceLayout {
  readonly air: AirLayout;
  readonly armies: CounterLayout;
  readonly armyRects: readonly ScreenRect[];
  /** The board the army counters draw. */
  readonly groundGame: GameState;
}

/** Where every army counter goes, as rectangles. */
function counterRects({ metrics: { height, width }, positions }: CounterLayout): readonly ScreenRect[] {
  return [...positions.values()].map((position) => ({ ...position, height, width }));
}

/**
 * Every counter on the map. Aircraft take spots the armies leave free; only where none is left
 * do the armies move aside for them.
 */
export function layoutPieces(
  scenarioPackage: ScenarioPackage,
  game: GameState,
  toScreen: (point: MapPoint) => MapPoint,
  options: PieceLayoutOptions,
  obstacles: readonly ScreenRect[]
): PieceLayout {
  const { map, scenario } = scenarioPackage;
  const groundGame = withoutAircraft(scenario, game);
  const layout = (avoid: readonly ScreenRect[]) => layoutCounters(groundGame, map, options.zoom, toScreen, avoid, options);
  const free = layout(obstacles);
  const freeRects = counterRects(free);
  const air = placeAircraft(scenarioPackage, game, toScreen, options, obstacles, freeRects);
  const armies = air.rects.some((rect) => freeRects.some((other) => intersects(rect, other))) ? layout([...obstacles, ...air.rects]) : free;
  return { air, armies, armyRects: counterRects(armies), groundGame };
}
