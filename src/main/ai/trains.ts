import { compareIds } from "../engine/board";
import { armyValue } from "../engine/combat";
import { railCapacity, railPlaces } from "../engine/movement/network";
import type { MoveRoute } from "../engine/movement/routes";
import { canFight } from "../engine/units/fighting";
import type { GameState, Scenario, SubTerritoryId, TerritoryId, UnitId, UnitState } from "../engine/types";
import { unitRoutes } from "./reach";

/**
 * D5: the train places the computer player has left as its plan takes shape. A station boards a
 * number of units a turn and refuses an army that does not fit whole, so the planner offers each
 * move only the units that still fit.
 */
export interface Trains {
  /** The boarding capital a unit's move to `to` uses, or undefined when it takes no train. */
  readonly boarding: (unit: UnitState, to: TerritoryId) => SubTerritoryId | undefined;
  /** The units that fit on the trains to `to` together, in the order given: the strongest, where too few places are left. */
  readonly fitting: (units: readonly UnitState[], to: TerritoryId) => readonly UnitState[];
  /** Takes a planned move's place. */
  readonly take: (unit: UnitState, to: TerritoryId) => void;
}

export function createTrains(scenario: Scenario, state: GameState): Trains {
  const taken = new Map<SubTerritoryId, number>();
  const routeOf = (unit: UnitState, to: TerritoryId): MoveRoute | undefined =>
    (scenario.rules.movement === "allowance" ? unitRoutes(scenario, state, unit).get(to) : undefined);
  const boarding = (unit: UnitState, to: TerritoryId): SubTerritoryId | undefined => routeOf(unit, to)?.rail?.boarding;
  return {
    boarding,
    fitting: (units, to) => {
      const aboard = new Map<SubTerritoryId, UnitState[]>();
      for (const unit of units) {
        const station = boarding(unit, to);
        if (station !== undefined) aboard.set(station, [...(aboard.get(station) ?? []), unit]);
      }
      const left = new Set<UnitId>();
      for (const [station, riders] of aboard) {
        const places = railCapacity(scenario, state, station) - (taken.get(station) ?? 0);
        const kept = new Set(strongestAboard(scenario, state, riders, places));
        for (const rider of riders) if (!kept.has(rider.id)) left.add(rider.id);
      }
      return units.filter((unit) => !left.has(unit.id));
    },
    take: (unit, to) => {
      const station = boarding(unit, to);
      if (station !== undefined) taken.set(station, (taken.get(station) ?? 0) + railPlaces(scenario, state, [unit.id]));
    }
  };
}

/** D5: the best of the units that fit in `places`: units that can fight first (D27.1), then the strongest attack, then defence, then id. */
export function strongestAboard(scenario: Scenario, state: GameState, units: readonly UnitState[], places: number): readonly UnitId[] {
  const value = (unit: UnitState, side: "attack" | "defence"): number => armyValue(scenario, unit, side);
  const fights = (unit: UnitState): number => Number(canFight(scenario, state.raised, unit.id));
  const ranked = [...units].sort((a, b) => fights(b) - fights(a) || value(b, "attack") - value(a, "attack") || value(b, "defence") - value(a, "defence") || compareIds(a.id, b.id));
  const aboard: UnitId[] = [];
  for (const { id } of ranked) if (railPlaces(scenario, state, [...aboard, id]) <= places) aboard.push(id);
  return aboard;
}
