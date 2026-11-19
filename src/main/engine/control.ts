import type { Armies } from "./board";
import { citiesIn, requireUnitState } from "./lookup";
import type { CityChange, CityId, ControlChange, FactionId, GameState, Scenario, TerritoryControl, TerritoryId } from "./types";

/**
 * M6, M7: after movement and battles, a territory changes hands only when exactly one faction
 * has armies there and either the set of factions present changed this turn or one of that
 * faction's armies ended the turn there having started elsewhere. Its cities follow. Holding
 * never changes control, which preserves the historical start.
 */
export function deriveControl(scenario: Scenario, start: GameState, armies: Armies): Pick<GameState, "cityControl" | "control"> {
  const control: Record<TerritoryId, TerritoryControl> = { ...start.control };
  const cityControl: Record<CityId, FactionId> = { ...start.cityControl };
  const before = presence(start.units);
  const after = presence(armies);

  for (const territory of scenario.territories) {
    const present = after.get(territory.id) ?? new Set<FactionId>();
    const [onlyFaction] = present;
    if (present.size !== 1 || onlyFaction === undefined) {
      continue;
    }
    const changed = !sameSet(before.get(territory.id) ?? new Set(), present);
    const entered = Object.values(armies).some((unit) =>
      unit.territoryId === territory.id && requireUnitState(start, unit.id).territoryId !== territory.id);
    if (changed || entered) {
      control[territory.id] = { factionId: onlyFaction, kind: "controlled" };
      for (const city of citiesIn(scenario, territory.id)) {
        cityControl[city.id] = onlyFaction;
      }
    }
  }
  return { cityControl, control };
}

export function diffControl(scenario: Scenario, before: GameState["control"], after: GameState["control"]): readonly ControlChange[] {
  return scenario.territories.flatMap((territory): ControlChange[] => {
    const previous = before[territory.id];
    const next = after[territory.id];
    return previous === undefined || next === undefined || sameControl(previous, next)
      ? []
      : [{ after: next, before: previous, territoryId: territory.id }];
  });
}

export function diffCities(scenario: Scenario, before: GameState["cityControl"], after: GameState["cityControl"]): readonly CityChange[] {
  return scenario.cities.flatMap((city): CityChange[] => {
    const controller = after[city.id];
    return controller === undefined || before[city.id] === controller
      ? []
      : [{ after: controller, before: before[city.id], cityId: city.id }];
  });
}

function presence(armies: Armies): ReadonlyMap<TerritoryId, ReadonlySet<FactionId>> {
  const result = new Map<TerritoryId, Set<FactionId>>();
  for (const unit of Object.values(armies)) {
    const factions = result.get(unit.territoryId) ?? new Set<FactionId>();
    factions.add(unit.factionId);
    result.set(unit.territoryId, factions);
  }
  return result;
}

function sameSet<Value>(left: ReadonlySet<Value>, right: ReadonlySet<Value>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function sameControl(left: TerritoryControl, right: TerritoryControl): boolean {
  if (left.kind === "controlled" && right.kind === "controlled") {
    return left.factionId === right.factionId;
  }
  if (left.kind === "contested" && right.kind === "contested") {
    return sameSet(new Set(left.factionIds), new Set(right.factionIds));
  }
  return false;
}
