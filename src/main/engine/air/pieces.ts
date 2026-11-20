import { holdsWhole } from "../partition/holders";
import { generalUnitDefinition } from "../generals/identity";
import { neighborsOf, requireUnitType } from "../lookup";
import type {
  FactionId,
  GameState,
  GeneralDefinition,
  RaisedUnitDefinition,
  Scenario,
  SubTerritoryId,
  TerritoryId,
  UnitDefinition,
  UnitId,
  UnitKind,
  UnitTypeDefinition
} from "../types";

/**
 * W5, U1-U6: what kind of piece a unit is. Aircraft and generals are units like any other, but
 * only ground units fight the ground battles (AG-3). A unit raised in play has no scenario
 * definition, so the state's `raised` record is read as well.
 */

/** A unit's definition, from the scenario or, for a unit raised in play, from the state. */
export function unitDefinitionIn(scenario: Scenario, raised: GameState["raised"], id: UnitId): UnitDefinition | RaisedUnitDefinition | undefined {
  return scenario.index.units.get(id) ?? raised[id] ?? generalUnitDefinition(scenario, id);
}

export function unitTypeIn(scenario: Scenario, raised: GameState["raised"], id: UnitId): UnitTypeDefinition | undefined {
  const definition = unitDefinitionIn(scenario, raised, id);
  return definition === undefined ? undefined : requireUnitType(scenario, definition.type);
}

/** The unit's kind; an unknown unit counts as ground, as the Milestone 2 rules treat every unit. */
export function unitKindIn(scenario: Scenario, raised: GameState["raised"], id: UnitId): UnitKind {
  return unitTypeIn(scenario, raised, id)?.kind ?? "ground";
}

export function isGroundUnit(scenario: Scenario, raised: GameState["raised"], id: UnitId): boolean {
  return unitKindIn(scenario, raised, id) === "ground";
}

/** U5: the roster general a general unit stands for. */
export function generalOf(scenario: Scenario, raised: GameState["raised"], id: UnitId): GeneralDefinition | undefined {
  const generalId = unitDefinitionIn(scenario, raised, id)?.generalId;
  return generalId === undefined ? undefined : scenario.index.generals.get(generalId);
}

/** U2: the territories an aircraft based at `from` reaches, with their distance in territories (land and sea). */
export function territoriesWithin(scenario: Scenario, from: TerritoryId, range: number): ReadonlyMap<TerritoryId, number> {
  const distance = new Map<TerritoryId, number>([[from, 0]]);
  let frontier: TerritoryId[] = [from];
  for (let step = 1; step <= range && frontier.length > 0; step += 1) {
    const next: TerritoryId[] = [];
    for (const id of frontier) {
      for (const neighbor of neighborsOf(scenario, id)) {
        if (distance.has(neighbor.territoryId)) continue;
        distance.set(neighbor.territoryId, step);
        next.push(neighbor.territoryId);
      }
    }
    frontier = next;
  }
  return distance;
}

/** Whether any building in the sub-territory has one of the given effect kinds. */
function hasBuildingEffect(scenario: Scenario, state: Pick<GameState, "subTerritories">, subTerritoryId: SubTerritoryId, kinds: readonly string[]): boolean {
  const buildings = state.subTerritories[subTerritoryId]?.buildings ?? [];
  return buildings.some((id) => scenario.index.buildings.get(id)?.effects.some((effect) => kinds.includes(effect.kind)) ?? false);
}

/** U2: a territory is an airbase for a faction when the faction holds a sub-territory there with an airfield (or a paved one), and no other faction controls the territory whole. */
export function isAirbaseFor(scenario: Scenario, state: Pick<GameState, "control" | "subTerritories">, territoryId: TerritoryId, factionId: FactionId): boolean {
  if (heldWholeByAnother(scenario, state, territoryId, factionId)) return false;
  return (scenario.index.subTerritoriesByTerritory.get(territoryId) ?? []).some((sub) =>
    state.subTerritories[sub.id]?.holder === factionId && hasBuildingEffect(scenario, state, sub.id, ["airbase", "all-weather-airbase"]));
}

/** U2: aircraft based here fly in every weather (a paved airfield the faction holds). */
export function isAllWeatherAirbaseFor(scenario: Scenario, state: Pick<GameState, "subTerritories">, territoryId: TerritoryId, factionId: FactionId): boolean {
  return (scenario.index.subTerritoriesByTerritory.get(territoryId) ?? []).some((sub) =>
    state.subTerritories[sub.id]?.holder === factionId && hasBuildingEffect(scenario, state, sub.id, ["all-weather-airbase"]));
}

/** Units of the given kind, in id order. */
export function unitsOfKind(scenario: Scenario, state: Pick<GameState, "raised" | "units">, kind: UnitKind): readonly UnitId[] {
  return Object.keys(state.units)
    .map((id) => id as UnitId)
    .filter((id) => unitKindIn(scenario, state.raised, id) === kind)
    .sort();
}

/** AG-3: the state with only its ground units, as the ground rules and their estimates see the board. */
export function groundView<State extends Pick<GameState, "raised" | "units">>(scenario: Scenario, state: State): State {
  const units = Object.fromEntries(Object.entries(state.units).filter(([id]) => isGroundUnit(scenario, state.raised, id as UnitId)));
  return Object.keys(units).length === Object.keys(state.units).length ? state : { ...state, units };
}

/**
 * CT-21, AG-2: under the d6 table generals are set aside from the ground steps, so they add no
 * point to a side, and this module gives their +1 and trait. The d20 module fights them as units of
 * value 0 and emits their modifiers itself (DC-16).
 */
export function generalsSetAside(scenario: Scenario): boolean {
  return scenario.rules.dice === "d6-table";
}

/**
 * D17, AG-17: whether a unit stands on the board through the ground steps (3 to 8), where it
 * holds ground, defends and counts for reinforcement (M11): never an aircraft, and a general
 * only under the d20 (under the d6 table generals are set aside with the aircraft).
 */
export function onGroundBoard(scenario: Scenario, raised: GameState["raised"], id: UnitId): boolean {
  const kind = unitKindIn(scenario, raised, id);
  return kind === "ground" || (kind === "general" && !generalsSetAside(scenario));
}

/** D17, W6: another faction holds the whole territory (`holdsWhole`, from the partition's holders). */
export function heldWholeByAnother(scenario: Scenario, state: Pick<GameState, "control" | "subTerritories">, territoryId: TerritoryId, factionId: FactionId): boolean {
  return scenario.factions.some((faction) => faction.id !== factionId && holdsWhole(scenario, state, territoryId, faction.id));
}
