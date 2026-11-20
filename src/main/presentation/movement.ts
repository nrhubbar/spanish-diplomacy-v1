import { battleSide } from "../engine/combat";
import { armyMovement, type MoveRoute, moveRoutes } from "../engine/movement/routes";
import { portLandings, railDepartures } from "../engine/movement/network";
import { weatherIn } from "../engine/weather";
import type { FactionId, GameState, MoveOrder, Scenario, SubTerritoryId, TerritoryId, UnitId, UnitState } from "../engine/types";
import { glyphs } from "./glyphs";
import type { DestinationEstimate } from "./odds";
import { territoryName } from "./text";

/**
 * X5: how the planning screen describes moves under the `allowance` module: the routes the
 * selected units can take, their tags and chips, the breakdown card, and the "Army leaving"
 * summary. Under `single-step` none of this applies and the functions return nothing.
 */

/**
 * The route the game offers for each destination of the selected units (M1-M5), or undefined
 * under `single-step`. A demoralized unit is offered no destination where another faction
 * stands (M23).
 */
export function selectionRoutes(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  from: TerritoryId | undefined,
  unitIds: readonly UnitId[],
  planned: readonly MoveOrder[]
): ReadonlyMap<TerritoryId, MoveRoute> | undefined {
  if (scenario.rules.movement !== "allowance") return undefined;
  if (from === undefined || unitIds.length === 0) return new Map();
  return moveRoutes(scenario, state, factionId, from, unitIds, planned);
}

export function subTerritoryName(scenario: Scenario, id: SubTerritoryId): string {
  return scenario.index.subTerritories.get(id)?.name ?? id;
}

/**
 * The route's shape as a tag, or undefined for a plain step: "By rail", "Rail, then attack",
 * "Amphibious". `short` is the map plaque's form ("Rail + attack").
 */
export function routeTag(route: MoveRoute, attacks = false, short = false): string | undefined {
  const then = (first: string, second: string): string => (short ? `${first} + ${second}` : `${first}, then ${second}`);
  switch (route.shape) {
    case "step":
      return undefined;
    case "march":
      return `March ${String(route.steps)}`;
    case "rail":
      return "By rail";
    case "step-rail":
      return then("Step", "rail");
    case "rail-step":
      return then("Rail", attacks ? "attack" : "step");
    case "sea":
      return route.sea?.kind === "amphibious" ? "Amphibious" : "By sea";
  }
}

/** What a destination row says beside its odds: the tag and the estimate, "By rail \u00b7 Reinforce". */
export function routeChipText(route: MoveRoute | undefined, chip: string, estimate?: DestinationEstimate): string {
  const tag = route === undefined ? undefined : routeTag(route, estimate?.kind === "battle");
  return tag === undefined ? chip : `${tag} ${glyphs.dot} ${chip}`;
}

export type RouteChipKind = "weather" | "terrain" | "fatigue" | "rail" | "sea" | "moves" | "transit";

export interface RouteChip {
  readonly kind: RouteChipKind;
  readonly text: string;
  /** A cost or a risk, drawn in the warning tone. */
  readonly warn: boolean;
}

function fatiguedUnits(scenario: Scenario, units: readonly UnitState[]): number {
  const level = scenario.d20?.fatigue.fatiguedLevel;
  return level === undefined ? 0 : units.filter((unit) => unit.fatigue >= level).length;
}

/** X5: the chips on a destination row: terrain, fatigue, rail or sea, transit and moves left (weather is `WeatherChip`). */
export function routeChips(
  scenario: Scenario,
  route: MoveRoute,
  units: readonly UnitState[],
  allowance: number,
  estimate: DestinationEstimate | undefined
): readonly RouteChip[] {
  // The weather chip is `m3r1-weather-timer`'s `WeatherChip`, drawn beside these.
  const chips: RouteChip[] = [];
  // A single step always fits (M1), so terrain is a cost only on a step or a march.
  for (const entry of route.shape === "step" || route.shape === "march" ? route.rough : []) {
    const terrain = scenario.index.subTerritories.get(entry)?.terrain ?? "mountain";
    chips.push({ kind: "terrain", text: `${terrain === "swamp" ? "Swamp" : "Mountain"} entry (${subTerritoryName(scenario, entry)})`, warn: true });
  }
  const fatigued = estimate?.kind === "battle" ? fatiguedUnits(scenario, units) : 0;
  if (fatigued > 0) chips.push({ kind: "fatigue", text: `Fatigued ${signedRoll(scenario.d20?.modifiers.fatigued ?? 0)} on ${String(fatigued)} ${fatigued === 1 ? "unit" : "units"}`, warn: true });
  if (route.rail !== undefined) chips.push({ kind: "rail", text: `Rail ${glyphs.dot} level ${String(route.rail.level)}`, warn: false });
  if (route.sea !== undefined) {
    chips.push(route.sea.kind === "port"
      ? { kind: "sea", text: `Port of ${subTerritoryName(scenario, route.sea.port ?? route.sea.departure)}`, warn: false }
      : { kind: "sea", text: `Amphibious ${signedRoll(scenario.d20?.modifiers.amphibious ?? 0)}`, warn: true });
  }
  if (route.transit.length > 0) chips.push({ kind: "transit", text: `Via ${route.transit.map((id) => territoryName(scenario, id)).join(", ")}`, warn: false });
  const left = allowance - route.cost;
  if ((route.shape === "step" || route.shape === "march") && left > 0) chips.push({ kind: "moves", text: `${String(left)} ${left === 1 ? "move" : "moves"} left after`, warn: false });
  return chips;
}

function signedRoll(value: number): string {
  if (value > 0) return `+${String(value)}`;
  return value < 0 ? `${glyphs.minus}${String(-value)}` : "0";
}

/** X5: the line under a destination's name that explains its route. Undefined for a plain step. */
export function routeDetail(scenario: Scenario, state: GameState, route: MoveRoute, usedDepartures: number): string | undefined {
  const parts: string[] = [];
  if (route.rail !== undefined) {
    const { rail } = route;
    const start = territoryName(scenario, rail.start);
    const end = territoryName(scenario, rail.end);
    const boarding = subTerritoryName(scenario, rail.boarding);
    const places = railDepartures(scenario, state, rail.boarding);
    parts.push(`Rail from ${start} to ${end}, level ${String(rail.level)} or better the whole way (range ${String(rail.range)})`);
    parts.push(`uses ${String(Math.min(places, usedDepartures + 1))} of ${boarding}'s ${String(places)} boarding ${places === 1 ? "place" : "places"}`);
  }
  if (route.sea !== undefined) {
    parts.push(route.sea.kind === "port"
      ? `Sails from ${subTerritoryName(scenario, route.sea.departure)}, lands at ${subTerritoryName(scenario, route.sea.port ?? route.sea.departure)} (${String(portLandings(scenario, route.sea.level ?? 0))} a turn)`
      : `Sails from ${subTerritoryName(scenario, route.sea.departure)} and storms the coast: one army per lane a turn`);
  }
  if (route.shape === "march" || route.shape === "step-rail" || route.shape === "rail-step") {
    parts.push(`Stops in ${route.transit.map((id) => territoryName(scenario, id)).join(", ")} if an enemy army enters it`);
  }
  return parts.length === 0 ? undefined : parts.join(` ${glyphs.dot} `);
}

/** X5: the rows of the breakdown card for a destination: what the route costs and why. */
export function routeRows(scenario: Scenario, state: GameState, route: MoveRoute, allowance: number): readonly { readonly label: string; readonly value: string }[] {
  const rows: { label: string; value: string }[] = [];
  // M1: a single step always fits, using at most the whole allowance.
  const used = route.steps <= 1 ? Math.min(route.cost, allowance) : route.cost;
  rows.push({ label: "Moves this turn", value: `${String(used)} of ${String(allowance)}` });
  for (const entry of route.shape === "step" || route.shape === "march" ? route.rough : []) rows.push({ label: `Enters ${subTerritoryName(scenario, entry)} (${scenario.index.subTerritories.get(entry)?.terrain ?? "mountain"})`, value: "+1 move" });
  if (route.rail !== undefined) rows.push({ label: `Rail, level ${String(route.rail.level)}`, value: `${String(route.rail.crossings)} of ${String(route.rail.range)} borders` });
  if (route.sea?.kind === "amphibious") rows.push({ label: "Amphibious assault", value: signedRoll(scenario.d20?.modifiers.amphibious ?? 0) });
  const weather = weatherIn(scenario, state, route.to);
  if (weather !== undefined) rows.push({ label: `Weather ${glyphs.dot} ${territoryName(scenario, route.to)}`, value: weather.name });
  return rows;
}

/** X5: "Army leaving Madrid": its units, attack, moves this turn and the truck rule. */
export function armyLeaving(scenario: Scenario, state: GameState, factionId: FactionId, from: TerritoryId, unitIds: readonly UnitId[]): { readonly heading: string; readonly line: string } | undefined {
  if (scenario.rules.movement !== "allowance" || unitIds.length === 0) return undefined;
  const units = unitIds.flatMap((id) => state.units[id] ?? []);
  const movement = armyMovement(scenario, state, factionId, from, unitIds);
  const attack = units.length === 0 ? 0 : battleSide(scenario, units, "attack").value;
  const count = `${String(units.length)} ${units.length === 1 ? "unit" : "units"}`;
  const needed = Math.ceil(movement.needing / 2);
  const trucks = movement.transports === 0
    ? (movement.allMobile ? "all mounted" : `no trucks (${String(needed)} ${needed === 1 ? "truck" : "trucks"} for these ${String(movement.needing)} ${movement.needing === 1 ? "unit" : "units"} would give +1)`)
    : `${String(movement.transports)} ${movement.transports === 1 ? "truck" : "trucks"} for ${String(movement.needing)} ${movement.needing === 1 ? "unit" : "units"}`;
  return {
    heading: `Army leaving ${territoryName(scenario, from)} ${glyphs.dot} ${count}, ${String(attack)} attack`,
    line: `${String(movement.allowance)} ${movement.allowance === 1 ? "move" : "moves"} this turn: ${trucks}. Rail does not use moves.`
  };
}
