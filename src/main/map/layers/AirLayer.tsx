import { type JSX, useMemo } from "react";
import { territoriesWithin, unitDefinitionIn, unitKindIn, unitTypeIn } from "../../engine/air/pieces";
import { compareIds } from "../../engine/board";
import type { AirMissionKind, GameState, Scenario, UnitId, UnitState } from "../../engine/types";
import { glyphs } from "../../presentation/glyphs";
import { cssVariables } from "../../presentation/style";
import { missionTerritoryId } from "../../state/planning/air";
import type { MapPackage, MapPoint } from "../../scenarios/loader";
import { mapTerritory } from "../anchors";
import { markupForSymbols } from "../symbols";
import type { MapLayerProps } from "./slots";

/** U2: the board without its aircraft, for the army counters; the air layer draws aircraft. */
export function withoutAircraft(scenario: Scenario, game: GameState): GameState {
  const units = Object.fromEntries(Object.entries(game.units).filter(([id]) => unitKindIn(scenario, game.raised, id as UnitId) !== "air"));
  return Object.keys(units).length === Object.keys(game.units).length ? game : { ...game, units };
}

/** U2: the counter's short tag, from the missions its type flies. */
export function aircraftTag(missions: readonly AirMissionKind[]): string {
  if (missions.includes("raid") || missions.includes("support")) return "BMB";
  if (missions.includes("intercept")) return "FTR";
  return "RCN";
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

const counterWidth = 30;
const counterHeight = 22;
/** Aircraft sit above their airfield, clear of the army counters below it. */
const lift = 30;

/**
 * Map layer (U2, Q-UX-10): aircraft counters at their airfields with the NATO APP-6A fixed-wing
 * symbol, selected like units. The selected aircraft shows its range ring (the farthest territory
 * it reaches), and every planned mission a dashed line from base to target.
 */
export function AirLayer({ game, scenarioPackage, toScreen, unitSymbols, view }: MapLayerProps): JSX.Element | null {
  const { map, scenario } = scenarioPackage;
  const symbols = useMemo(() => markupForSymbols(scenario, unitSymbols), [scenario, unitSymbols]);
  const aircraft = Object.values(game.units)
    .filter((unit) => unitKindIn(scenario, game.raised, unit.id) === "air")
    .sort((a, b) => compareIds(a.territoryId, b.territoryId) || compareIds(a.factionId, b.factionId) || compareIds(a.id, b.id));
  if (aircraft.length === 0) return null;

  const placed = new Map<string, number>();
  const counters = aircraft.map((unit) => {
    const base = toScreen(basePoint(scenario, map, game, unit));
    const key = `${unit.territoryId}|${unit.factionId}`;
    const index = placed.get(key) ?? 0;
    placed.set(key, index + 1);
    return { base, position: { x: base.x - counterWidth / 2 + index * (counterWidth + 2), y: base.y - lift - counterHeight }, unit };
  });
  const selected = counters.find((entry) => entry.unit.id === view.selectedAircraftId);
  const ring = selected === undefined ? undefined : rangeRing(scenario, map, game, selected.unit, selected.base, toScreen);
  const lines = (view.plannedAirMissions ?? []).flatMap((order) => {
    const from = counters.find((entry) => entry.unit.id === order.unitId);
    const target = missionTerritoryId(scenario, order.mission);
    if (from === undefined || target === undefined) return [];
    const to = toScreen(mapTerritory(map, target).label);
    return [{ from: { x: from.position.x + counterWidth / 2, y: from.position.y + counterHeight / 2 }, id: order.unitId, kind: order.mission.kind, to }];
  });

  return (
    <div className="air-layer">
      <svg aria-hidden="true" className="air-layer-lines">
        {ring === undefined ? null : <circle className="air-range-ring" cx={ring.x} cy={ring.y} r={ring.r} />}
        {lines.map((line) => (
          <line className="air-mission-line" data-mission={line.kind} key={line.id} x1={line.from.x} x2={line.to.x} y1={line.from.y} y2={line.to.y} />
        ))}
      </svg>
      {counters.map(({ position, unit }) => {
        const definition = unitDefinitionIn(scenario, game.raised, unit.id);
        const type = unitTypeIn(scenario, game.raised, unit.id);
        const faction = scenario.index.factions.get(unit.factionId);
        const tag = aircraftTag(type?.air?.missions ?? []);
        const planned = view.plannedAirMissions?.find((order) => order.unitId === unit.id);
        const name = definition?.name ?? unit.id;
        const label = `${name}, ${type?.name ?? "aircraft"}, ${faction?.name ?? unit.factionId}${planned === undefined ? "" : `, ${planned.mission.kind} mission planned`}`;
        return (
          <button
            aria-pressed={view.onSelectUnit === undefined ? undefined : view.selectedAircraftId === unit.id}
            className="air-counter"
            data-planned={planned !== undefined}
            data-selected={view.selectedAircraftId === unit.id}
            data-unit-id={unit.id}
            key={unit.id}
            onClick={(event) => {
              event.stopPropagation();
              view.onSelectUnit?.(unit);
            }}
            style={cssVariables({ "--faction-color": faction?.color ?? "#888888" }, { height: counterHeight, left: position.x, top: position.y, width: counterWidth })}
            tabIndex={view.onSelectUnit === undefined ? -1 : 0}
            title={name}
            type="button"
          >
            <span className="visually-hidden">{label}</span>
            <span aria-hidden="true" className="air-counter-symbol" dangerouslySetInnerHTML={{ __html: symbols.get(`${unit.factionId}:${definition?.type ?? ""}`) ?? "" }} />
            <span aria-hidden="true" className="air-counter-tag">{tag}</span>
            {planned === undefined ? null : <span aria-hidden="true" className="air-counter-badge">{glyphs.check}</span>}
          </button>
        );
      })}
    </div>
  );
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
  const range = unitTypeIn(scenario, game.raised, unit.id)?.air?.range;
  if (range === undefined) return undefined;
  let r = 0;
  for (const territoryId of territoriesWithin(scenario, unit.territoryId, range).keys()) {
    const point = toScreen(mapTerritory(map, territoryId).label);
    r = Math.max(r, Math.hypot(point.x - base.x, point.y - base.y));
  }
  return { r, x: base.x, y: base.y };
}
