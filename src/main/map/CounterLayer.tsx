import { type JSX, useMemo } from "react";
import { requireFaction, requireUnitDefinition } from "../engine/lookup";
import type { GameState, Scenario, UnitState } from "../engine/types";
import { territoryAnchor } from "./anchors";
import type { MapPackage, MapPoint } from "../scenarios/loader";
import { glyphs } from "../presentation/glyphs";
import { cssVariables } from "../presentation/style";
import { compactStrength, unitDesignation } from "../presentation/text";
import type { SemanticLevel } from "./camera";
import { markupForSymbols } from "./symbols";
import { type CounterMetrics, placeCounters, type ScreenRect } from "./placement";
import type { MapView } from "./view";

export const counterMetrics: Readonly<Record<SemanticLevel, CounterMetrics>> = {
  detail: { gap: 3, height: 40, perRow: 4, width: 50 },
  operational: { gap: 3, height: 31, perRow: 4, width: 40 },
  overview: { gap: 2, height: 24, perRow: 5, width: 32 }
};

/**
 * Screen positions (top-left) of every counter at this zoom level. Each unit sits at its city,
 * or at its territory's anchor, and stacks avoid each other and the given obstacles.
 */
export function layoutCounters(
  game: GameState,
  map: MapPackage,
  level: SemanticLevel,
  toScreen: (point: MapPoint) => MapPoint,
  obstacles: readonly ScreenRect[]
): ReadonlyMap<string, MapPoint> {
  return placeCounters(
    Object.values(game.units).map((unit) => {
      const cityPoint = unit.cityId === undefined ? undefined : map.cities.get(unit.cityId);
      const anchor = cityPoint ?? territoryAnchor(map, unit.territoryId);
      return { anchor: toScreen(anchor), anchorKey: cityPoint === undefined ? `t:${unit.territoryId}` : `c:${String(unit.cityId)}`, id: unit.id };
    }),
    counterMetrics[level],
    obstacles
  );
}

interface CounterLayerProps {
  readonly game: GameState;
  readonly level: SemanticLevel;
  /** From `layoutCounters`. */
  readonly positions: ReadonlyMap<string, MapPoint>;
  readonly scenario: Scenario;
  readonly unitSymbols: ReadonlyMap<string, string>;
  readonly view: MapView;
}

export function CounterLayer({ game, level, positions, scenario, unitSymbols, view }: CounterLayerProps): JSX.Element {
  const symbols = useMemo(() => markupForSymbols(scenario, unitSymbols), [scenario, unitSymbols]);
  const units = Object.values(game.units);
  const metrics = counterMetrics[level];

  return (
    <div className="counter-layer" data-level={level}>
      {units.map((unit) => {
        const position = positions.get(unit.id);
        return position === undefined ? null : (
          <Counter
            key={unit.id}
            metrics={metrics}
            ordered={view.orderedUnitIds.has(unit.id)}
            position={position}
            scenario={scenario}
            selected={view.selectedUnitIds.has(unit.id)}
            symbol={symbols.get(`${unit.factionId}:${requireUnitDefinition(scenario, unit.id).type}`) ?? ""}
            unit={unit}
            view={view}
          />
        );
      })}
    </div>
  );
}

interface CounterProps {
  readonly metrics: CounterMetrics;
  readonly ordered: boolean;
  readonly position: MapPoint;
  readonly scenario: Scenario;
  readonly selected: boolean;
  readonly symbol: string;
  readonly unit: UnitState;
  readonly view: MapView;
}

function Counter({ metrics, ordered, position, scenario, selected, symbol, unit, view }: CounterProps): JSX.Element {
  const definition = requireUnitDefinition(scenario, unit.id);
  const faction = requireFaction(scenario, unit.factionId);
  const name = definition.name;
  const strength = definition.approximateStrength;
  const label = [
    name,
    faction.name,
    strength === undefined ? undefined : `about ${String(strength)} personnel`,
    ordered ? "order planned" : undefined
  ].filter((part) => part !== undefined).join(", ");
  const style = cssVariables(
    { "--faction-color": faction.color },
    { height: metrics.height, left: position.x, top: position.y, width: metrics.width }
  );

  return (
    <button
      aria-label={label}
      aria-pressed={view.onSelectUnit === undefined ? undefined : selected}
      className="unit-counter"
      data-ordered={ordered}
      data-selected={selected}
      data-unit-id={unit.id}
      onClick={(event) => {
        event.stopPropagation();
        view.onSelectUnit?.(unit);
      }}
      style={style}
      tabIndex={view.onSelectUnit === undefined ? -1 : 0}
      title={name}
      type="button"
    >
      <span aria-hidden="true" className="unit-counter-symbol" dangerouslySetInnerHTML={{ __html: symbol }} />
      <span aria-hidden="true" className="unit-counter-designation">{unitDesignation(name)}</span>
      <span aria-hidden="true" className="unit-counter-strength">{compactStrength(strength)}</span>
      {ordered ? <span aria-hidden="true" className="unit-counter-badge">{glyphs.check}</span> : null}
    </button>
  );
}
