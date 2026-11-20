import { describe, expect, it } from "vitest";
import { dateLabel, turnDate } from "../main/engine/calendar";
import { hookedAllowanceDelta, hookedCanDigIn, hookedCombatModifiers, hookedGrounded } from "../main/engine/hooks";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import { isD6Battle } from "../main/engine/types";
import type { BuildingId, GameState, Scenario, SubTerritoryId, WeatherId, WeatherState, WeatherZoneId } from "../main/engine/types";
import { beforePlanning, forecast, isSeaRouteClosed, rollWeather, weatherIn } from "../main/engine/weather";
import { destinationEstimates, modifierName, modifierPhrase } from "../main/presentation/odds";
import { turnLabel } from "../main/presentation/turn";
import { advance } from "../main/state/coordinator";
import { faction, move, spain, territory, tiny, unit, withUnits } from "./support";

const zones = ["cantabrian", "meseta", "mediterranean", "south"] as const;

function weatherOf(outcomes: Partial<Record<(typeof zones)[number], string>>): WeatherState {
  return { outcomes: outcomes as Readonly<Record<string, string>> as Record<WeatherZoneId, WeatherId>, roll: 10 };
}

function withWeather(state: GameState, outcomes: Partial<Record<(typeof zones)[number], string>>, turnNumber = state.turnNumber): GameState {
  return { ...state, turnNumber, weather: weatherOf(outcomes) };
}

const d20Spain = (): Scenario => {
  const scenario = spain();
  return { ...scenario, rules: { ...scenario.rules, dice: "d20-graded" } };
};

describe("the calendar (T1)", () => {
  const calendar = { start: { half: "late", month: 7, year: 1936 }, turnsPerYear: 24 } as const;

  it("starts in Late July 1936 and moves by half-months", () => {
    expect(dateLabel(turnDate(calendar, 1))).toBe("Late July 1936");
    expect(dateLabel(turnDate(calendar, 2))).toBe("Early August 1936");
    expect(dateLabel(turnDate(calendar, 7))).toBe("Late October 1936");
    expect(dateLabel(turnDate(calendar, 12))).toBe("Early January 1937");
    expect(dateLabel(turnDate(calendar, 25))).toBe("Late July 1937");
  });

  it("puts the date in every turn label of a scenario with a calendar", () => {
    expect(turnLabel(spain(), 7)).toBe("Turn 7 · Late October 1936");
    expect(turnLabel(spain(), 1)).toBe("Turn 1 · Late July 1936");
    expect(turnLabel(tiny(), 2)).toBe("Turn 2");
  });
});

describe("the weather roll (T2)", () => {
  it("is one seeded d20 a turn, the same wherever it is computed", () => {
    const a = rollWeather(spain(), 42, 5);
    expect(a).toEqual(rollWeather(spain(), 42, 5));
    expect(a?.roll).toBeGreaterThanOrEqual(1);
    expect(a?.roll).toBeLessThanOrEqual(20);
    expect(Object.keys(a?.outcomes ?? {}).sort()).toEqual([...zones].sort());
    const rolls = new Set(Array.from({ length: 60 }, (_, seed) => rollWeather(spain(), seed, 5)?.roll));
    expect(rolls.size).toBeGreaterThan(10);
  });

  it("reads one roll against every zone's table, best to worst", () => {
    // Winter (turn 12, January): a 20 is the worst row everywhere, a 1 the best.
    for (let seed = 0; seed < 200; seed += 1) {
      const weather = rollWeather(spain(), seed, 12);
      if (weather?.roll === 20) expect(weather.outcomes).toEqual({ cantabrian: "severe-cold", mediterranean: "snow", meseta: "severe-cold", south: "mud" });
      if (weather?.roll === 1) expect(Object.values(weather.outcomes)).toEqual(["clear", "clear", "clear", "clear"]);
    }
  });

  it("has no weather without the module", () => {
    expect(rollWeather(tiny(), 1, 1)).toBeUndefined();
    const state = initialGameState(tiny());
    expect(beforePlanning(tiny(), state, 1)).toBe(state);
  });

  it("is in the state before planning, idempotently (step 0)", () => {
    const start = initialGameState(spain());
    const ready = beforePlanning(spain(), start, 7);
    expect(ready.weather).toEqual(rollWeather(spain(), 7, 1));
    expect(beforePlanning(spain(), ready, 7)).toBe(ready);
    const session = advance(spain(), { assignments: { [faction("republic")]: "local-human", [faction("north")]: "computer", [faction("south")]: "computer" }, history: [], locked: {}, scenarioId: spain().id, seed: 7, state: start });
    expect(session.phase).toBe("planning");
    if (session.phase === "planning") expect(session.game.state.weather).toEqual(ready.weather);
  });

  it("forecasts a turn from its season's table, most likely first (T3)", () => {
    const summer = forecast(spain(), "meseta" as WeatherZoneId, 1);
    expect(summer.map((entry) => [entry.outcome.id, entry.chance])).toEqual([["clear", 0.5], ["hot", 0.5]]);
    const winter = forecast(spain(), "cantabrian" as WeatherZoneId, 12);
    expect(winter.reduce((sum, entry) => sum + entry.chance, 0)).toBeCloseTo(1);
    expect(winter[0]?.outcome.id).toBe("rain");
    expect(forecast(tiny(), "meseta" as WeatherZoneId, 1)).toEqual([]);
  });

  it("records the turn's weather in the report", () => {
    const state = withWeather(initialGameState(spain()), { cantabrian: "rain", mediterranean: "clear", meseta: "clear", south: "hot" });
    const result = resolveTurn(spain(), state, [], 3);
    expect(result.outcomes).toContainEqual({ kind: "weather-rolled", turnNumber: 1, weather: state.weather });
  });
});

describe("the weather's effects (T4)", () => {
  const madrid = territory("madrid");
  const base = () => withUnits(spain(), [["r1", "republic", "madrid"], ["n1", "north", "castilla-y-leon"]]);

  it("puts the soft attack modifier on battles, a third of it on the d6 table (D7, Q-WX-6)", () => {
    const context = (scenario: Scenario, state: GameState) => ({ attackerFactionId: faction("north"), defenderFactionIds: [faction("republic")], diggingIn: false, scenario, state, territoryId: madrid });
    const severe = withWeather(base(), { meseta: "severe-cold" });
    expect(hookedCombatModifiers(context(d20Spain(), severe))).toEqual([{ kind: "weather", roll: -6, weatherId: "severe-cold" }]);
    expect(hookedCombatModifiers(context(spain(), severe))).toEqual([{ kind: "weather", roll: -2, weatherId: "severe-cold" }]);
    expect(hookedCombatModifiers(context(spain(), withWeather(base(), { meseta: "mud" })))).toEqual([{ kind: "weather", roll: -1, weatherId: "mud" }]);
    expect(hookedCombatModifiers(context(d20Spain(), withWeather(base(), { meseta: "rain" })))).toEqual([]);
    expect(hookedCombatModifiers(context(d20Spain(), base()))).toEqual([]);
  });

  it("stops digging in during Snow and Severe cold", () => {
    const at = (state: GameState) => hookedCanDigIn({ factionId: faction("republic"), scenario: spain(), state, territoryId: madrid });
    expect(at(withWeather(base(), { meseta: "snow" }))).toBe(false);
    expect(at(withWeather(base(), { meseta: "severe-cold" }))).toBe(false);
    expect(at(withWeather(base(), { meseta: "mud" }))).toBe(true);
    expect(at(base())).toBe(true);
  });

  it("takes a move off the allowance in Mud and Snow", () => {
    const delta = (state: GameState) => hookedAllowanceDelta({ factionId: faction("republic"), from: madrid, scenario: spain(), state, unitIds: [unit("r1")] });
    expect(delta(withWeather(base(), { meseta: "mud" }))).toBe(-1);
    expect(delta(withWeather(base(), { meseta: "snow" }))).toBe(-1);
    expect(delta(withWeather(base(), { meseta: "severe-cold" }))).toBe(0);
  });

  it("grounds aircraft in Mud and Snow unless their airfield is paved", () => {
    const muddy = withWeather(base(), { meseta: "mud" });
    const grounded = (state: GameState) => hookedGrounded({ scenario: spain(), state, territoryId: madrid, unitId: unit("r1") });
    expect(grounded(muddy)).toBe(true);
    expect(grounded(withWeather(base(), { meseta: "rain" }))).toBe(false);
    const site = "madrid" as SubTerritoryId;
    const current = muddy.subTerritories[site];
    if (current === undefined) throw new Error("Madrid has no sub-territory state.");
    const paved = { ...muddy, subTerritories: { ...muddy.subTerritories, [site]: { ...current, buildings: [...current.buildings, "paved-airfield" as BuildingId] } } };
    expect(grounded(paved)).toBe(current.holder !== faction("republic"));
  });

  it("closes the sea when a coastal zone touching it has Rain in December to February", () => {
    const january = withWeather(base(), { mediterranean: "rain", south: "clear" }, 12);
    expect(isSeaRouteClosed(spain(), january, territory("catalunya"), territory("islas-baleares"))).toBe(true);
    expect(isSeaRouteClosed(spain(), january, territory("andalucia"), territory("ceuta"))).toBe(false);
    expect(isSeaRouteClosed(spain(), withWeather(base(), { mediterranean: "rain" }, 7), territory("catalunya"), territory("islas-baleares"))).toBe(false);
    expect(isSeaRouteClosed(spain(), january, territory("madrid"), territory("castilla-la-mancha"))).toBe(false);
  });

  it("costs units that move in Severe cold 5 percent of their men", () => {
    const state = withWeather(base(), { meseta: "severe-cold" });
    const result = resolveTurn(spain(), state, [{ factionId: faction("republic"), orders: [move("republic", "r1", "madrid", "castilla-la-mancha")] }], 1);
    expect(result.outcomes).toContainEqual({ factionId: "republic", kind: "frostbite", men: 5, territoryId: "castilla-la-mancha", unitId: "r1" });
    expect(result.finalState.units[unit("r1")]?.strength).toBe(95);
    expect(result.finalState.units[unit("n1")]?.strength).toBe(100);
    expect(weatherIn(spain(), state, madrid)?.name).toBe("Severe cold");
  });
});

describe("time running out (T5, T6)", () => {
  it("reports whose time ran out and how many units held", () => {
    const state = withUnits(spain(), [["r1", "republic", "madrid"], ["r2", "republic", "madrid"], ["r3", "republic", "madrid"]]);
    const result = resolveTurn(spain(), state, [{ factionId: faction("republic"), orders: [move("republic", "r1", "madrid", "castilla-la-mancha")], timedOut: true }], 1);
    expect(result.outcomes).toContainEqual({ factionId: "republic", heldUnitCount: 2, kind: "time-ran-out" });
    const tinyResult = resolveTurn(tiny(), initialGameState(tiny()), [{ factionId: faction("red"), orders: [], timedOut: true }], 1);
    expect(tinyResult.outcomes.filter((outcome) => outcome.kind === "time-ran-out")).toHaveLength(1);
  });
});

describe("the weather modifier in the odds and battle text (D7)", () => {
  it("names the weather and its roll change on destination rows and battle cards", () => {
    const state = withWeather(initialGameState(spain()), { meseta: "mud" });
    const attackers = Object.values(state.units).filter((candidate) => candidate.factionId === faction("north") && candidate.territoryId === territory("castilla-y-leon"));
    const estimate = destinationEstimates(spain(), state, faction("north"), attackers.map((candidate) => candidate.id), [territory("madrid")]).get(territory("madrid"));
    expect(estimate?.kind === "battle" ? estimate.modifiers.map(modifierPhrase) : []).toContain("Mud −1");
    const orders = attackers.map((candidate) => move("north", candidate.id, "castilla-y-leon", "madrid"));
    const result = resolveTurn(spain(), state, [{ factionId: faction("north"), orders }], 1);
    const battle = result.outcomes.filter(isD6Battle)[0];
    expect(battle?.modifiers).toContainEqual({ kind: "weather", roll: -1, weatherId: "mud" });
    expect(modifierName({ kind: "weather", roll: -6, weatherId: "severe-cold" as WeatherId })).toBe("Severe cold");
  });
});
