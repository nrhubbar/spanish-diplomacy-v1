import { onGroundBoard } from "./air/pieces";
import type { Armies } from "./board";
import { citiesIn } from "./lookup";
import type { CityChange, CityId, ControlChange, FactionId, GameState, Scenario, TerritoryControl, TerritoryId } from "./types";

/**
 * R2: the factions with ground armies in each territory, in id order. Aircraft never count
 * (nor generals under the d6 table, which sets them aside from the ground steps: `onGroundBoard`).
 */
export function groundSides(scenario: Scenario, raised: GameState["raised"], armies: Armies): ReadonlyMap<TerritoryId, readonly FactionId[]> {
  const sides = new Map<TerritoryId, Set<FactionId>>();
  for (const unit of Object.values(armies)) {
    if (!onGroundBoard(scenario, raised, unit.id)) continue;
    sides.set(unit.territoryId, (sides.get(unit.territoryId) ?? new Set<FactionId>()).add(unit.factionId));
  }
  return new Map([...sides].map(([territoryId, factions]) => [territoryId, [...factions].sort()] as const));
}

/** R2: the one side with ground armies in the territory; undefined where none or several have. */
export function loneSide(sides: ReadonlyMap<TerritoryId, readonly FactionId[]>, territoryId: TerritoryId): FactionId | undefined {
  const present = sides.get(territoryId) ?? [];
  return present.length === 1 ? present[0] : undefined;
}

/**
 * M6, R2: after movement and battles, a territory where only one side has ground armies is that
 * side's, whole, with its cities; that includes a contested territory one side was left alone
 * in. Where nobody (or several sides) has ground armies, control stays as it was. Aircraft never
 * count.
 */
export function deriveControl(scenario: Scenario, start: GameState, armies: Armies): Pick<GameState, "cityControl" | "control"> {
  const control: Record<TerritoryId, TerritoryControl> = { ...start.control };
  const cityControl: Record<CityId, FactionId> = { ...start.cityControl };
  const sides = groundSides(scenario, start.raised, armies);
  for (const territory of scenario.territories) {
    const only = loneSide(sides, territory.id);
    if (only === undefined) continue;
    const current = control[territory.id];
    if (current?.kind !== "controlled" || current.factionId !== only) control[territory.id] = { factionId: only, kind: "controlled" };
    for (const city of citiesIn(scenario, territory.id)) cityControl[city.id] = only;
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
