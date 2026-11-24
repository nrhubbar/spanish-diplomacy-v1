import { monthOfTurn } from "./calendar";
import { pick, rollStream } from "./dice";
import type {
  ConnectionDefinition,
  GameState,
  Scenario,
  Season,
  TerritoryId,
  WeatherEffect,
  WeatherId,
  WeatherOutcome,
  WeatherRules,
  WeatherState,
  WeatherZone,
  WeatherZoneId
} from "./types";

/**
 * T2-T4: the seasonal weather. One d20 a turn, from the game's `weather` roll stream, read
 * against every zone's table for the season of the turn's month. Tables run from the best
 * weather to the worst, so one roll gives the same "kind of turn" across the map (Q-WX-1).
 *
 * The weather is rolled before planning (step 0), by `beforePlanning`, so the start-of-turn
 * state that planning, the computer player and every hook read already holds it (CT-44).
 */

const weatherDieFaces = 20;

/** Whether the scenario plays with weather: the module is on and its data is present. */
export function weatherRules(scenario: Scenario): WeatherRules | undefined {
  return scenario.rules.weather === "none" || scenario.calendar === undefined ? undefined : scenario.weather;
}

/** The season holding a calendar month. The loader guarantees exactly one (L20). */
function seasonOf(rules: WeatherRules, month: number): Season | undefined {
  return rules.seasons.find((season) => season.months.includes(month));
}

/** The outcome a roll gives in a zone's table for a season. */
function readTable(zone: WeatherZone, season: Season, roll: number): WeatherId | undefined {
  return zone.tables[season.id]?.find((band) => roll <= band.upTo)?.outcome;
}

/** T2: the turn's weather, the same for a given game seed and turn wherever it is computed. */
export function rollWeather(scenario: Scenario, seed: number, turnNumber: number): WeatherState | undefined {
  const rules = weatherRules(scenario);
  if (rules === undefined || scenario.calendar === undefined) return undefined;
  const season = seasonOf(rules, monthOfTurn(scenario.calendar, turnNumber));
  if (season === undefined) return undefined;
  const roll = pick(rollStream(seed, "weather", turnNumber, 0), weatherDieFaces);
  const outcomes: Record<WeatherZoneId, WeatherId> = {};
  for (const zone of rules.zones) {
    const outcome = readTable(zone, season, roll);
    if (outcome !== undefined) outcomes[zone.id] = outcome;
  }
  return { outcomes, roll };
}

function sameWeather(a: WeatherState | undefined, b: WeatherState | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  const zones = Object.keys(b.outcomes) as WeatherZoneId[];
  return a.roll === b.roll && Object.keys(a.outcomes).length === zones.length && zones.every((zone) => a.outcomes[zone] === b.outcomes[zone]);
}

/**
 * Section 2, step 0: what the state holds before anyone plans the turn. Idempotent, and it
 * returns the same object when nothing changes, so it may run on every hand-off.
 */
export function beforePlanning(scenario: Scenario, state: GameState, seed: number): GameState {
  const weather = rollWeather(scenario, seed, state.turnNumber);
  if (weather === undefined || sameWeather(state.weather, weather)) return state;
  return { ...state, weather };
}

/** A territory's climate zone, when the scenario has weather. */
export function zoneOf(scenario: Scenario, territoryId: TerritoryId): WeatherZone | undefined {
  const zoneId = scenario.index.territories.get(territoryId)?.weatherZoneId;
  return zoneId === undefined ? undefined : weatherRules(scenario)?.zones.find((zone) => zone.id === zoneId);
}

export function weatherOutcome(scenario: Scenario, id: WeatherId): WeatherOutcome | undefined {
  return weatherRules(scenario)?.outcomes.find((outcome) => outcome.id === id);
}

/** The weather in a zone this turn; undefined before the roll or without weather. */
function zoneWeather(scenario: Scenario, state: GameState, zoneId: WeatherZoneId): WeatherOutcome | undefined {
  const id = state.weather?.outcomes[zoneId];
  return id === undefined ? undefined : weatherOutcome(scenario, id);
}

/** The weather in a territory this turn, read from its zone. */
export function weatherIn(scenario: Scenario, state: GameState, territoryId: TerritoryId): WeatherOutcome | undefined {
  const zone = zoneOf(scenario, territoryId);
  return zone === undefined ? undefined : zoneWeather(scenario, state, zone.id);
}

/** The effects of a given kind that this turn's weather has in a territory. */
export function weatherEffectsIn<K extends WeatherEffect["kind"]>(
  scenario: Scenario,
  state: GameState,
  territoryId: TerritoryId,
  kind: K
): readonly Extract<WeatherEffect, { readonly kind: K }>[] {
  const effects = weatherIn(scenario, state, territoryId)?.effects ?? [];
  return effects.filter((effect): effect is Extract<WeatherEffect, { readonly kind: K }> => effect.kind === kind);
}

/** One outcome's chance in a forecast. */
export interface ForecastChance {
  /** 0-1. */
  readonly chance: number;
  readonly outcome: WeatherOutcome;
}

/**
 * T3: a turn's odds in a zone, from its season's table, most likely first (ties in table
 * order, best weather first). It reads the table only, never the seeded roll.
 */
export function forecast(scenario: Scenario, zoneId: WeatherZoneId, turnNumber: number): readonly ForecastChance[] {
  const rules = weatherRules(scenario);
  const zone = rules?.zones.find((candidate) => candidate.id === zoneId);
  if (rules === undefined || zone === undefined || scenario.calendar === undefined) return [];
  const season = seasonOf(rules, monthOfTurn(scenario.calendar, turnNumber));
  const bands = season === undefined ? [] : zone.tables[season.id] ?? [];
  const faces = new Map<WeatherId, number>();
  let floor = 0;
  for (const band of bands) {
    faces.set(band.outcome, (faces.get(band.outcome) ?? 0) + (band.upTo - floor));
    floor = band.upTo;
  }
  return [...faces]
    .flatMap(([id, count]) => {
      const outcome = weatherOutcome(scenario, id);
      return outcome === undefined ? [] : [{ chance: count / weatherDieFaces, outcome }];
    })
    .sort((a, b) => b.chance - a.chance);
}

/**
 * T4, Q-MR-30: a sea connection is closed this turn when a coastal zone at either end has an
 * outcome that closes the sea in the turn's month (Spain: Rain in December to February).
 * Read by the movement area (`m3r1-movement-rail-ports`) when it validates sea moves.
 */
export function isSeaConnectionClosed(scenario: Scenario, state: GameState, connection: Pick<ConnectionDefinition, "between" | "kind">): boolean {
  if (connection.kind !== "sea" || scenario.calendar === undefined) return false;
  const month = monthOfTurn(scenario.calendar, state.turnNumber);
  return connection.between.some((territoryId) => zoneOf(scenario, territoryId)?.coastal === true
    && weatherEffectsIn(scenario, state, territoryId, "closes-sea").some((effect) => effect.months.includes(month)));
}

/** The same, for a sea move between two territories; false when no sea connection joins them. */
export function isSeaRouteClosed(scenario: Scenario, state: GameState, from: TerritoryId, to: TerritoryId): boolean {
  return scenario.connections.some((connection) => connection.kind === "sea"
    && connection.between.includes(from) && connection.between.includes(to)
    && isSeaConnectionClosed(scenario, state, connection));
}
