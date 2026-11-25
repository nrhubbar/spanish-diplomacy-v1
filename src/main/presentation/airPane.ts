import { generalOf, isAllWeatherAirbaseFor, territoriesWithin, unitKindIn, unitTypeIn } from "../engine/air/pieces";
import { missionTerritory } from "../engine/air/validation";
import { hookedGrounded } from "../engine/hooks";
import { requireFaction, requireUnitDefinition, requireUnitType } from "../engine/lookup";
import { weatherEffectsIn, weatherIn, zoneOf } from "../engine/weather";
import type { AirMission, AirMissionKind, AirMissionOrder, GameState, GeneralDefinition, GeneralTrait, Scenario, TerritoryId, UnitId, UnitState, UnitTypeDefinition, WeatherOutcome } from "../engine/types";
import { type ArmyFigures, armyFigures, figuresDescription, type GroupFigures, groupFigures, groupLabel } from "./army";
import { glyphs } from "./glyphs";
import { territoryName, unitName } from "./text";

/**
 * U2, U3, U5 (`ux-air-a.webp`, `ux-pane-a-units.webp`): the words of the aircraft pane and of a
 * general's pill. The pane renders what these return.
 */

/** U2, U14: mission names as the pane's buttons read them. */
export const missionNames: Readonly<Record<AirMissionKind, string>> = { patrol: "Patrol", raid: "Raid", recon: "Recon", support: "Ground Support" };

/** U14: the order the pane offers the missions in. */
export const missionButtonOrder: readonly AirMissionKind[] = ["patrol", "support", "raid", "recon"];

export const missionHints: Readonly<Record<AirMissionKind, string>> = {
  patrol: "Fighters over a territory worsen enemy raids there and can shoot raiders down.",
  raid: "A raid on one sub-territory rolls: air eliminated, nothing hit, income cut for a turn, or a building hit.",
  recon: "Shows the territory's balances, queues and training next turn.",
  support: "Aircraft over a battle add to their side's roll."
};

/** The line under the aircraft's name: type, base (paved or not) and range. */
export function aircraftMeta(type: UnitTypeDefinition | undefined, base: string, paved: boolean): string {
  return `${type?.name ?? "Aircraft"} ${glyphs.dot} based at ${base}${paved ? " (paved airfield)" : ""} ${glyphs.dot} range ${String(type?.air?.range ?? 0)} territories`;
}

/** The missions the type flies; the others are greyed. */
export function allowedMissions(type: UnitTypeDefinition | undefined): readonly AirMissionKind[] {
  return type?.air?.missions ?? [];
}

/** A mission button's tooltip: what the mission does, or why this type cannot fly it. */
export function missionTitle(type: UnitTypeDefinition | undefined, mission: AirMissionKind): string {
  return allowedMissions(type).includes(mission) ? missionHints[mission] : `A ${type?.name ?? "aircraft"} cannot fly this mission.`;
}

/** An aircraft in a list: its name and its mission this turn. */
export function aircraftLine(name: string, mission: AirMissionKind | undefined): string {
  return `${name} ${glyphs.dot} ${mission === undefined ? "standing down" : missionNames[mission]}`;
}

/** U3: the raid card's anti-air (a roll change, 0 or less) and the enemy fighters that may intercept. */
export function antiAirLabel(antiAir: number): string {
  return antiAir === 0 ? "none" : `${glyphs.minus}${String(Math.abs(antiAir))}`;
}

export function fightersLabel(fightersInReach: number): string {
  return fightersInReach === 0 ? "none" : "may intercept";
}

/** M11, T3: whether the aircraft flies from its base in this weather. */
export function baseWeatherVerdict(grounds: boolean, paved: boolean, weatherName: string): string {
  return !grounds ? "flies" : paved ? "flies (paved airfield)" : `grounded (${weatherName})`;
}

export function baseWeatherHeading(zone: string | undefined): string {
  return `Weather${zone === undefined ? "" : ` ${glyphs.dot} ${zone}`} `;
}

/** U5: a general's pill, his name and his trait. */
export function generalPill(general: GeneralDefinition, trait: GeneralTrait | undefined): { readonly text: string; readonly title: string } {
  return trait === undefined
    ? { text: general.name, title: general.name }
    : { text: `${general.name} ${glyphs.dot} ${trait.name}`, title: `${general.name}: ${trait.name}` };
}

/** U2, D7: the role a counter prints in place of its short name, from the missions its type flies. */
export function aircraftTag(missions: readonly AirMissionKind[]): string {
  // Fighters also fly Ground Support, so Patrol decides first.
  if (missions.includes("patrol")) return "FTR";
  if (missions.includes("raid") || missions.includes("support")) return "BOMB";
  return "RCN";
}

/** U2, D7: what an aircraft's card on the map says. */
export interface AircraftCounterText {
  readonly color: string;
  readonly figures: ArmyFigures;
  readonly grounded: boolean;
  readonly label: string;
  readonly name: string;
  readonly planned: AirMissionOrder | undefined;
  readonly symbolKey: string;
  readonly tag: string;
}

/** N6: what to do while a mission chooses its target: the territory, then, for a raid, the sub-territory. */
export function missionCallout(scenario: Scenario, unitId: UnitId, mission: AirMissionKind, territoryId: TerritoryId | undefined): string {
  const name = unitName(scenario, unitId);
  const choose = territoryId === undefined ? "Choose a highlighted territory on the map." : `Choose what to raid in ${territoryName(scenario, territoryId)}.`;
  return `${name}: ${missionNames[mission]}. ${choose}`;
}

export function aircraftCounterText(scenario: Scenario, state: GameState, unit: UnitState, plannedAirMissions: readonly AirMissionOrder[] | undefined): AircraftCounterText {
  const definition = requireUnitDefinition(scenario, unit.id);
  const type = requireUnitType(scenario, definition.type);
  const faction = requireFaction(scenario, unit.factionId);
  const planned = plannedAirMissions?.find((order) => order.unitId === unit.id);
  const figures = armyFigures(scenario, withoutWorks(state), unit);
  return {
    color: faction.color,
    figures,
    grounded: isGrounded(scenario, state, unit),
    label: [
      unitName(scenario, unit.id),
      type.name,
      faction.name,
      figuresDescription(figures),
      ...(planned === undefined ? [] : [`${planned.mission.kind} mission planned`]),
      ...groundedWords(scenario, state, unit)
    ].join(", "),
    name: unitName(scenario, unit.id),
    planned,
    symbolKey: `${unit.factionId}:${definition.type}`,
    tag: aircraftTag(allowedMissions(type))
  };
}

/** D7: what one card for several aircraft at a base says. */
export interface AircraftGroupText {
  readonly color: string;
  readonly figures: GroupFigures;
  readonly grounded: boolean;
  readonly label: string;
  /** Every aircraft in the group has a planned mission. */
  readonly ordered: boolean;
}

/** The aircraft share a faction and a base, so the weather grounds all of them or none. */
export function aircraftGroupText(scenario: Scenario, state: GameState, units: readonly UnitState[], plannedAirMissions: readonly AirMissionOrder[] | undefined): AircraftGroupText {
  const [first] = units;
  if (first === undefined) throw new Error("A group of aircraft has at least one.");
  const faction = requireFaction(scenario, first.factionId);
  const figures = groupFigures(scenario, withoutWorks(state), units);
  const missions = (plannedAirMissions ?? []).filter((order) => units.some((unit) => unit.id === order.unitId));
  const words = missionButtonOrder
    .map((kind) => ({ count: missions.filter((order) => order.mission.kind === kind).length, kind }))
    .filter(({ count }) => count > 0)
    .map(({ count, kind }) => `${String(count)} ${kind} planned`);
  return {
    color: faction.color,
    figures,
    grounded: isGrounded(scenario, state, first),
    label: [groupLabel(faction.name, territoryName(scenario, first.territoryId), figures, "aircraft"), ...words, ...groundedWords(scenario, state, first)].join(", "),
    ordered: missions.length === units.length
  };
}

/** Field works shelter armies on the ground, so an aircraft's card never shows them. */
function withoutWorks(state: GameState): GameState {
  return { ...state, fortification: {} };
}

/** T3: whether the weather at its base keeps an aircraft on the ground, by the rule the turn resolves with. */
function isGrounded(scenario: Scenario, state: GameState, unit: UnitState): boolean {
  return hookedGrounded({ scenario, state, territoryId: unit.territoryId, unitId: unit.id });
}

function groundedWords(scenario: Scenario, state: GameState, unit: UnitState): readonly string[] {
  const weather = weatherIn(scenario, state, unit.territoryId);
  return weather !== undefined && isGrounded(scenario, state, unit) ? [`grounded by ${weather.name.toLowerCase()}`] : [];
}

/** M11, T3: the weather at an aircraft's base and whether it flies from there. */
export interface BaseWeather {
  readonly grounded: boolean;
  readonly heading: string;
  readonly verdict: string;
  readonly weather: WeatherOutcome;
}

export function baseWeather(scenario: Scenario, state: GameState, unit: UnitState): BaseWeather | undefined {
  const weather = weatherIn(scenario, state, unit.territoryId);
  if (weather === undefined) return undefined;
  const grounds = weatherEffectsIn(scenario, state, unit.territoryId, "grounds-aircraft").length > 0;
  const grounded = isGrounded(scenario, state, unit);
  return {
    grounded,
    heading: baseWeatherHeading(zoneOf(scenario, unit.territoryId)?.name),
    verdict: baseWeatherVerdict(grounds, grounds && !grounded, weather.name),
    weather
  };
}

/** Whether two missions are the same mission on the same target. */
export function sameMission(a: AirMission | undefined, b: AirMission): boolean {
  if (a?.kind !== b.kind) return false;
  return a.kind === "raid" || b.kind === "raid"
    ? a.kind === "raid" && b.kind === "raid" && a.subTerritoryId === b.subTerritoryId
    : a.territoryId === b.territoryId;
}

/** The territory a mission is flown over. */
export function missionOver(scenario: Scenario, mission: AirMission): TerritoryId | undefined {
  return missionTerritory(scenario, mission);
}

/** The anti-air line's heading: the territory a raid is flown over. */
export function antiAirHeading(scenario: Scenario, mission: AirMission, targetName: string): string {
  const territoryId = missionTerritory(scenario, mission);
  return `Anti-air in ${territoryId === undefined ? targetName : territoryName(scenario, territoryId)}`;
}

/** The territories an aircraft reaches from its base; undefined for a unit that doesn't fly. */
export function flightRange(scenario: Scenario, state: Pick<GameState, "raised">, unit: UnitState): readonly TerritoryId[] | undefined {
  const range = unitTypeIn(scenario, state.raised, unit.id)?.air?.range;
  return range === undefined ? undefined : [...territoriesWithin(scenario, unit.territoryId, range).keys()];
}

export interface AircraftView {
  readonly base: string;
  readonly meta: string;
  readonly missions: readonly { readonly allowed: boolean; readonly kind: AirMissionKind; readonly title: string }[];
  readonly name: string;
  /** The faction's other aircraft at the base. */
  readonly others: readonly UnitState[];
  readonly range: number;
}

/** U2: the selected aircraft: its base, type and range, and the missions its type flies. */
export function aircraftView(scenario: Scenario, state: GameState, unit: UnitState): AircraftView {
  const type = unitTypeIn(scenario, state.raised, unit.id);
  const base = territoryName(scenario, unit.territoryId);
  const allowed = allowedMissions(type);
  return {
    base,
    meta: aircraftMeta(type, base, isAllWeatherAirbaseFor(scenario, state, unit.territoryId, unit.factionId)),
    missions: missionButtonOrder.map((kind) => ({ allowed: allowed.includes(kind), kind, title: missionTitle(type, kind) })),
    name: unitName(scenario, unit.id),
    others: Object.values(state.units).filter((other) => other.id !== unit.id && other.factionId === unit.factionId
      && other.territoryId === unit.territoryId && unitKindIn(scenario, state.raised, other.id) === "air"),
    range: type?.air?.range ?? 0
  };
}

/** U5: a general's pill, and whether he may be sacked; undefined for any other unit. */
export function generalView(scenario: Scenario, state: Pick<GameState, "raised">, unitId: UnitId): (ReturnType<typeof generalPill> & { readonly canSack: boolean }) | undefined {
  const general = generalOf(scenario, state.raised, unitId);
  if (general === undefined) return undefined;
  return {
    ...generalPill(general, scenario.generalTraits.find((candidate) => candidate.id === general.traitId)),
    canSack: unitTypeIn(scenario, state.raised, unitId)?.orders.includes("sack") ?? false
  };
}
