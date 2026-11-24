import { type JSX, useMemo } from "react";
import { requireFaction, requireUnitDefinition } from "../engine/lookup";
import type { GameState, Scenario, TerritoryId } from "../engine/types";
import { armyFigures, counterLabel, groupFigures, groupLabel, groupOrdersDescription } from "../presentation/army";
import { generalWords } from "../presentation/generals";
import { territoryName } from "../presentation/text";
import type { MapPackage, MapPoint } from "../scenarios/loader";
import { territoryAnchor } from "./anchors";
import { type SemanticLevel, semanticLevel } from "./camera";
import { armyItems, type CounterItem, groupedItems } from "./counterItems";
import { GroupCounter } from "./GroupCounter";
import { type CounterMetrics, placeCounterStacks, type ScreenRect } from "./placement";
import { markupForSymbols } from "./symbols";
import { UnitCounter } from "./UnitCounter";
import { glows, type MapView } from "./view";

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

/**
 * Z1: below this camera zoom (the 125% the zoom readout shows), every faction's armies in a
 * territory share one summed counter, whatever the room on screen.
 */
export const individualCountersFromZoom = 1.25;

/** The compact counters this zoom always uses, whatever the room on screen; undefined where armies may show one by one. */
export function compactMetricsAt(zoom: number, narrow: boolean): CounterMetrics | undefined {
  const level = semanticLevel(zoom);
  if (level === "detail") return undefined;
  return zoom < individualCountersFromZoom || (narrow && level === "overview") ? compactMetrics[level] : undefined;
}

export interface CounterLayout {
  readonly compact: boolean;
  readonly items: readonly CounterItem[];
  readonly metrics: CounterMetrics;
  /** Screen top-left of each item, by item key. */
  readonly positions: ReadonlyMap<string, MapPoint>;
}

export interface LayoutOptions {
  /** The selected or focused territory, whose armies always show one by one (Z2). */
  readonly expandedTerritoryId?: TerritoryId;
  /** A phone-width map: the overview is compact from the start. */
  readonly narrow: boolean;
}

/**
 * Where every counter goes at this camera zoom. Each army sits at its city or its territory's
 * anchor, and stacks avoid each other and the obstacles. Below `individualCountersFromZoom`
 * each faction's armies in a territory always share one compact counter at the territory's
 * anchor (Z1). From there up to the detail zoom they share one only when a stack would be
 * pushed far from its territory, and always at a phone's overview. The expanded territory
 * always shows its armies one by one (Z2).
 */
export function layoutCounters(
  game: GameState,
  map: MapPackage,
  zoom: number,
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
  const level = semanticLevel(zoom);
  const individual = armyItems(game);
  const metrics = counterMetrics[level];
  if (level === "detail") return { compact: false, items: individual, metrics, positions: place(individual, metrics, false).positions };
  const spread = compactMetricsAt(zoom, narrow) !== undefined ? undefined : place(individual, metrics, false);
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
          const orders = groupOrdersDescription(item.units.flatMap((unit) => {
            const order = view.unitOrders?.get(unit.id);
            return order === undefined ? [] : [order];
          }));
          return (
            <GroupCounter
              factionColor={faction.color}
              figures={figures}
              key={item.key}
              label={orders === "" ? label : `${label}, ${orders}`}
              metrics={metrics}
              onSelect={onSelectTerritory === undefined ? undefined : () => { onSelectTerritory(item.territoryId); }}
              selected={item.units.some((unit) => glows(view, unit.id))}
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
            effect={generalWords(scenario, game.raised, unit.id)?.text}
            factionColor={requireFaction(scenario, unit.factionId).color}
            figures={figures}
            key={item.key}
            label={counterLabel(scenario, figures, unit, view.unitOrders?.get(unit.id))}
            metrics={metrics}
            designation={definition.designation}
            name={definition.name}
            onSelect={view.onSelectUnit}
            ordered={ordered}
            position={position}
            selected={view.selectedUnitIds.has(unit.id)}
            ticked={view.tickedUnitIds?.has(unit.id) === true}
            symbol={symbols.get(`${unit.factionId}:${definition.type}`) ?? ""}
            unit={unit}
            worksMax={worksMax}
          />
        );
      })}
    </div>
  );
}
