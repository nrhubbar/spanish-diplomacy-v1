import { type JSX, useMemo } from "react";
import { requireFaction, requireUnitDefinition } from "../engine/lookup";
import type { GameState, Scenario, TerritoryId } from "../engine/types";
import { armyFigures, counterLabel, groupFigures, groupLabel } from "../presentation/army";
import { territoryName } from "../presentation/text";
import type { MapPackage, MapPoint } from "../scenarios/loader";
import { territoryAnchor } from "./anchors";
import type { SemanticLevel } from "./camera";
import { armyItems, type CounterItem, groupedItems } from "./counterItems";
import { GroupCounter } from "./GroupCounter";
import { type CounterMetrics, placeCounterStacks, type ScreenRect } from "./placement";
import { markupForSymbols } from "./symbols";
import { UnitCounter } from "./UnitCounter";
import type { MapView } from "./view";

/**
 * Counter sizes per zoom level, in screen pixels. Overview counters print the values and the
 * strength bar; operational adds the symbol, designation, and struck-through full values;
 * detail adds the men. Every size keeps the 24 x 24 px target (WCAG 2.2) and 11 px text.
 */
export const counterMetrics: Readonly<Record<SemanticLevel, CounterMetrics>> = {
  detail: { gap: 4, height: 56, perRow: 4, width: 58 },
  operational: { gap: 4, height: 39, perRow: 4, width: 54 },
  overview: { gap: 2, height: 24, perRow: 5, width: 32 }
};

/**
 * Compact counters, wide enough for combined values such as "13-21", two to a row so the
 * selected territory's armies form a tight block. Detail is never compact.
 */
export const compactMetrics: Readonly<Record<Exclude<SemanticLevel, "detail">, CounterMetrics>> = {
  operational: { gap: 4, height: 39, perRow: 2, width: 56 },
  overview: { gap: 4, height: 24, perRow: 2, width: 48 }
};

/**
 * A stack pushed further than this from its first-choice spot has left its territory's
 * neighbourhood, so the map switches to compact counters.
 */
export function crowdedDisplacement(metrics: CounterMetrics): number {
  return 3 * metrics.height;
}

export interface CounterLayout {
  readonly compact: boolean;
  readonly items: readonly CounterItem[];
  readonly metrics: CounterMetrics;
  /** Screen top-left of each item, by item key. */
  readonly positions: ReadonlyMap<string, MapPoint>;
}

export interface LayoutOptions {
  /** The selected territory, whose armies always show one by one. */
  readonly expandedTerritoryId?: TerritoryId;
  /** A phone-width map: the overview is compact from the start. */
  readonly narrow: boolean;
}

/**
 * Where every counter goes at this zoom level. Each army sits at its city or its territory's
 * anchor, and stacks avoid each other and the obstacles. Below the detail zoom, when a stack
 * would be pushed far from its territory (and always at a phone's overview), each faction's
 * armies in a territory share one compact counter at the territory's anchor instead.
 */
export function layoutCounters(
  game: GameState,
  map: MapPackage,
  level: SemanticLevel,
  toScreen: (point: MapPoint) => MapPoint,
  obstacles: readonly ScreenRect[],
  { expandedTerritoryId, narrow }: LayoutOptions
): CounterLayout {
  const place = (items: readonly CounterItem[], metrics: CounterMetrics, grouped: boolean) => placeCounterStacks(
    items.map((item) => {
      const unit = item.kind === "army" ? item.unit : undefined;
      const territoryId = item.kind === "army" ? item.unit.territoryId : item.territoryId;
      const cityPoint = unit?.cityId === undefined || (grouped && territoryId !== expandedTerritoryId) ? undefined : map.cities.get(unit.cityId);
      const anchor = cityPoint ?? territoryAnchor(map, territoryId);
      return { anchor: toScreen(anchor), anchorKey: cityPoint === undefined ? `t:${territoryId}` : `c:${String(unit?.cityId)}`, id: item.key };
    }),
    metrics,
    obstacles
  );
  const individual = armyItems(game);
  const metrics = counterMetrics[level];
  if (level === "detail") return { compact: false, items: individual, metrics, positions: place(individual, metrics, false).positions };
  const spread = narrow && level === "overview" ? undefined : place(individual, metrics, false);
  if (spread !== undefined && spread.maxDisplacement <= crowdedDisplacement(metrics)) {
    return { compact: false, items: individual, metrics, positions: spread.positions };
  }
  const items = groupedItems(game, expandedTerritoryId);
  return { compact: true, items, metrics: compactMetrics[level], positions: place(items, compactMetrics[level], true).positions };
}

interface CounterLayerProps {
  readonly game: GameState;
  readonly layout: CounterLayout;
  readonly level: SemanticLevel;
  readonly scenario: Scenario;
  readonly unitSymbols: ReadonlyMap<string, string>;
  readonly view: MapView;
}

export function CounterLayer({ game, layout, level, scenario, unitSymbols, view }: CounterLayerProps): JSX.Element {
  const symbols = useMemo(() => markupForSymbols(scenario, unitSymbols), [scenario, unitSymbols]);
  const { metrics, positions } = layout;
  const worksMax = scenario.combat.diggingIn.max;

  return (
    <div className="counter-layer" data-compact={layout.compact} data-level={level}>
      {layout.items.map((item) => {
        const position = positions.get(item.key);
        if (position === undefined) return null;
        if (item.kind === "group") {
          const figures = groupFigures(scenario, game, item.units);
          const faction = requireFaction(scenario, item.factionId);
          const onSelectTerritory = view.onSelectTerritory;
          const ordered = item.units.filter((unit) => view.orderedUnitIds.has(unit.id)).length;
          const label = groupLabel(faction.name, territoryName(scenario, item.territoryId), figures);
          return (
            <GroupCounter
              factionColor={faction.color}
              figures={figures}
              key={item.key}
              label={ordered === 0 ? label : `${label}, ${String(ordered)} with orders planned`}
              metrics={metrics}
              onSelect={onSelectTerritory === undefined ? undefined : () => { onSelectTerritory(item.territoryId); }}
              ordered={ordered === item.units.length}
              position={position}
              worksMax={worksMax}
            />
          );
        }
        const { unit } = item;
        const definition = requireUnitDefinition(scenario, unit.id);
        const figures = armyFigures(scenario, game, unit);
        const ordered = view.orderedUnitIds.has(unit.id);
        return (
          <UnitCounter
            factionColor={requireFaction(scenario, unit.factionId).color}
            figures={figures}
            key={item.key}
            label={counterLabel(scenario, figures, unit, ordered)}
            metrics={metrics}
            designation={definition.designation}
            name={definition.name}
            onSelect={view.onSelectUnit}
            ordered={ordered}
            position={position}
            selected={view.selectedUnitIds.has(unit.id)}
            symbol={symbols.get(`${unit.factionId}:${definition.type}`) ?? ""}
            unit={unit}
            worksMax={worksMax}
          />
        );
      })}
    </div>
  );
}
