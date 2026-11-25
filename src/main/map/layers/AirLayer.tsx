import { type JSX, useMemo } from "react";
import type { AirMission, GameState, Scenario, UnitId, UnitState } from "../../engine/types";
import { aircraftCounterText, aircraftGroupText, flightRange, missionOver } from "../../presentation/airPane";
import type { MapPackage, MapPoint } from "../../scenarios/loader";
import { mapTerritory } from "../anchors";
import { itemUnits } from "../counterItems";
import { GroupCounter } from "../GroupCounter";
import type { AirLayout } from "../pieceLayout";
import { markupForSymbols } from "../symbols";
import { UnitCounter } from "../UnitCounter";
import { glows } from "../view";
import type { MapLayerProps } from "./slots";

interface AirLayerProps extends MapLayerProps {
  /** From `layoutPieces`, so aircraft and armies avoid each other. */
  readonly layout: AirLayout;
}

/**
 * Map layer (U2, D7): aircraft at their airfields, on the army counters' own cards, with the role
 * in the short name's place, selected like units. The selected aircraft shows its range ring (the
 * farthest territory it reaches), and every planned mission a dashed line from base to target.
 */
export function AirLayer({ game, layout, level, scenarioPackage, toScreen, unitSymbols, view }: AirLayerProps): JSX.Element | null {
  const { map, scenario } = scenarioPackage;
  const symbols = useMemo(() => markupForSymbols(scenario, unitSymbols), [scenario, unitSymbols]);
  const { metrics, placements } = layout;
  if (placements.length === 0) return null;
  const placementOf = (id: UnitId | undefined) => placements.find(({ item }) => itemUnits(item).some((unit) => unit.id === id));
  const selected = view.selectedAircraftId === undefined ? undefined : game.units[view.selectedAircraftId];
  const selectedBase = placementOf(selected?.id)?.base;
  const ring = selected === undefined || selectedBase === undefined ? undefined : rangeRing(scenario, map, game, selected, selectedBase, toScreen);
  const lines = (view.plannedAirMissions ?? []).flatMap((order) => {
    const from = placementOf(order.unitId);
    const target = missionOver(scenario, order.mission);
    if (from === undefined || target === undefined) return [];
    const to = toScreen(missionPoint(map, order.mission) ?? mapTerritory(map, target).label);
    return [{ from: { x: from.position.x + metrics.width / 2, y: from.position.y + metrics.height / 2 }, id: order.unitId, kind: order.mission.kind, to }];
  });
  const worksMax = scenario.combat.diggingIn.max;
  const onSelectTerritory = view.onSelectTerritory;

  return (
    <div className="counter-layer air-layer" data-level={level}>
      <svg aria-hidden="true" className="air-layer-lines">
        {ring === undefined ? null : <circle className="air-range-ring" cx={ring.x} cy={ring.y} r={ring.r} />}
        {lines.map((line) => (
          <line className="air-mission-line" data-mission={line.kind} key={line.id} x1={line.from.x} x2={line.to.x} y1={line.from.y} y2={line.to.y} />
        ))}
      </svg>
      {placements.map(({ item, position }) => {
        if (item.kind === "group") {
          const group = aircraftGroupText(scenario, game, item.units, view.plannedAirMissions);
          return (
            <GroupCounter
              air={{ grounded: group.grounded }}
              factionColor={group.color}
              figures={group.figures}
              key={item.key}
              label={group.label}
              metrics={metrics}
              onSelect={onSelectTerritory === undefined ? undefined : () => { onSelectTerritory(item.territoryId); }}
              ordered={group.ordered}
              position={position}
              selected={item.units.some((unit) => glows(view, unit.id))}
              worksMax={worksMax}
            />
          );
        }
        const { unit } = item;
        const aircraft = aircraftCounterText(scenario, game, unit, view.plannedAirMissions);
        return (
          <UnitCounter
            air={{ grounded: aircraft.grounded }}
            designation={aircraft.tag}
            factionColor={aircraft.color}
            figures={aircraft.figures}
            key={item.key}
            label={aircraft.label}
            metrics={metrics}
            name={aircraft.name}
            onSelect={view.onSelectUnit}
            ordered={aircraft.planned !== undefined}
            position={position}
            selected={view.selectedAircraftId === unit.id}
            symbol={symbols.get(aircraft.symbolKey) ?? ""}
            ticked={view.tickedUnitIds?.has(unit.id) === true}
            unit={unit}
            worksMax={worksMax}
          />
        );
      })}
    </div>
  );
}

/** U14 (note 7): a raid's line ends on its target sub-territory's town; other missions end on the territory. */
function missionPoint(map: MapPackage, mission: AirMission): MapPoint | undefined {
  return mission.kind === "raid" ? map.subTerritories?.entries.get(mission.subTerritoryId)?.capital : undefined;
}

/** U2: a circle around the base through the farthest territory in range, in screen space. */
function rangeRing(
  scenario: Scenario,
  map: MapPackage,
  game: GameState,
  unit: UnitState,
  base: MapPoint,
  toScreen: MapLayerProps["toScreen"]
): { readonly r: number; readonly x: number; readonly y: number } | undefined {
  const range = flightRange(scenario, game, unit);
  if (range === undefined) return undefined;
  let r = 0;
  for (const territoryId of range) {
    const point = toScreen(mapTerritory(map, territoryId).label);
    r = Math.max(r, Math.hypot(point.x - base.x, point.y - base.y));
  }
  return { r, x: base.x, y: base.y };
}
