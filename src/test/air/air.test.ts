import { describe, expect, it } from "vitest";
import { raidIncomeDelta } from "../../main/engine/air/hooks";
import { raidResult } from "../../main/engine/air/missions";
import { groundView, isAirbaseFor, territoriesWithin } from "../../main/engine/air/pieces";
import { validateAirMission } from "../../main/engine/air/validation";
import { pick, rollStream } from "../../main/engine/dice";
import type { RuleModule } from "../../main/engine/modules";
import { initialGameState, resolveTurn } from "../../main/engine/resolution";
import type {
  AirMission,
  AirMissionOrder,
  GameState,
  PlayerSubmission,
  RaisedUnitDefinition,
  Scenario,
  SubTerritoryId,
  TurnOutcome,
  UnitId,
  UnitTypeId
} from "../../main/engine/types";
import { validateMoveOrder } from "../../main/engine/validation";
import { faction, move, spain, territory, unit } from "../support";

const seed = 7;

function mission(factionId: string, unitId: string, flown: AirMission): AirMissionOrder {
  return { factionId: faction(factionId), kind: "air-mission", mission: flown, unitId: unit(unitId) };
}

function raid(factionId: string, unitId: string, subTerritoryId: string): AirMissionOrder {
  return mission(factionId, unitId, { kind: "raid", subTerritoryId: subTerritoryId as SubTerritoryId });
}

function submit(...orders: readonly AirMissionOrder[]): readonly PlayerSubmission[] {
  const factions = [...new Set(orders.map((order) => order.factionId))];
  return factions.map((factionId) => ({ factionId, orders: orders.filter((order) => order.factionId === factionId) }));
}

/** Adds a unit raised in play (a recruited type), as `GameState.raised` carries it. */
function withRaised(state: GameState, id: string, factionId: string, type: string, territoryId: string): GameState {
  const definition: RaisedUnitDefinition = { factionId: faction(factionId), fullStrength: 300, id: unit(id), name: id, type: type as UnitTypeId };
  return {
    ...state,
    raised: { ...state.raised, [id]: definition },
    units: { ...state.units, [id]: { factionId: faction(factionId), fatigue: 0, id: unit(id), morale: { demoralized: false, quietTurns: 0 }, strength: 300, territoryId: territory(territoryId) } }
  };
}

const kinds = (outcomes: readonly TurnOutcome[]): readonly string[] => outcomes.map((outcome) => outcome.kind);
const raidOf = (outcomes: readonly TurnOutcome[]) => outcomes.find((outcome): outcome is Extract<TurnOutcome, { kind: "raid" }> => outcome.kind === "raid");

describe("aircraft and their missions (U2)", () => {
  const scenario = spain();
  const state = initialGameState(scenario);

  it("reaches territories within its range, by land and sea connections", () => {
    const reach = territoriesWithin(scenario, territory("madrid"), 1);
    expect(reach.get(territory("madrid"))).toBe(0);
    expect(reach.get(territory("castilla-y-leon"))).toBe(1);
    expect(reach.has(territory("galicia"))).toBe(false);
  });

  it("flies only from an airfield its faction holds", () => {
    expect(isAirbaseFor(scenario, state, territory("madrid"), faction("republic"))).toBe(true);
    expect(isAirbaseFor(scenario, state, territory("madrid"), faction("north"))).toBe(false);
    expect(isAirbaseFor(scenario, state, territory("extremadura"), faction("republic"))).toBe(false);
  });

  it("validates the mission against the type, the range and the target", () => {
    expect(validateAirMission(scenario, state, raid("republic", "rep-breguet-bombers", "burgos"))).toEqual({ ok: true });
    expect(validateAirMission(scenario, state, raid("republic", "rep-breguet-bombers", "madrid")).ok).toBe(false);
    expect(validateAirMission(scenario, state, raid("republic", "rep-ni52-fighters", "burgos")).ok).toBe(false);
    expect(validateAirMission(scenario, state, raid("republic", "rep-wad-ras-1", "burgos")).ok).toBe(false);
    expect(validateAirMission(scenario, state, raid("north", "rep-breguet-bombers", "burgos")).ok).toBe(false);
    const outOfRange = scenario.territories.find((candidate) => !territoriesWithin(scenario, territory("madrid"), 1).has(candidate.id));
    expect(validateAirMission(scenario, state, mission("republic", "rep-ni52-fighters", { kind: "intercept", territoryId: territory("castilla-y-leon") })).ok).toBe(true);
    expect(outOfRange).toBeDefined();
    expect(validateAirMission(scenario, state, mission("republic", "rep-catalan-recon", { kind: "recon", territoryId: territory("catalunya") })).ok).toBe(false);
    expect(validateAirMission(scenario, state, mission("republic", "rep-catalan-recon", { kind: "recon", territoryId: territory("aragon") })).ok).toBe(true);
  });

  it("never marches: aircraft take only the orders their type allows (W5)", () => {
    expect(validateMoveOrder(scenario, state, move("republic", "rep-breguet-bombers", "madrid", "castilla-la-mancha")).ok).toBe(false);
    expect(groundView(scenario, state).units[unit("rep-breguet-bombers")]).toBeUndefined();
    expect(groundView(scenario, state).units[unit("rep-wad-ras-1")]).toBeDefined();
  });

  it("reads the raid table by the modified roll, clamped to the die", () => {
    expect(raidResult(scenario, -4)).toBe("air-eliminated");
    expect(raidResult(scenario, 3)).toBe("air-eliminated");
    expect(raidResult(scenario, 4)).toBe("nothing-hit");
    expect(raidResult(scenario, 16)).toBe("income-cut");
    expect(raidResult(scenario, 25)).toBe("building-hit");
  });
});

describe("raids (U3)", () => {
  const scenario = spain();
  const state = initialGameState(scenario);
  const die = pick(rollStream(seed, "raid", 1, 0), 20);

  it("rolls a d20 from the raid stream and reports the result", () => {
    const result = resolveTurn(scenario, state, submit(raid("republic", "rep-breguet-bombers", "burgos")), seed);
    const flown = raidOf(result.outcomes);
    expect(flown).toMatchObject({ roll: die, subTerritoryId: "burgos" });
    expect(flown?.result).toBe(raidResult(scenario, die));
  });

  it("is worsened by 3 for anti-air in the target territory", () => {
    const defended = withRaised(state, "north-flak", "north", "anti-air-battery", "castilla-y-leon");
    const flown = raidOf(resolveTurn(scenario, defended, submit(raid("republic", "rep-breguet-bombers", "burgos")), seed).outcomes);
    expect(flown?.roll).toBe(die - 3);
  });

  it("is worsened by each intercepting fighter, which shoots the raider down on an air-eliminated roll", () => {
    const guarded = withRaised(state, "north-fighters", "north", "fighter-squadron", "castilla-y-leon");
    const outcomes = resolveTurn(scenario, guarded, submit(
      raid("republic", "rep-breguet-bombers", "burgos"),
      mission("north", "north-fighters", { kind: "intercept", territoryId: territory("castilla-y-leon") })
    ), seed).outcomes;
    const flown = raidOf(outcomes);
    expect(flown?.roll).toBe(die - 2);
    const interception = outcomes.find((outcome) => outcome.kind === "interception");
    expect(interception).toMatchObject({ factionId: "north", interceptorIds: ["north-fighters"], raiderIds: ["rep-breguet-bombers"] });
  });

  it("loses the raider on an air-eliminated result", () => {
    // Enough anti-air and fighters push any die into the first band.
    let doomed = withRaised(state, "north-flak", "north", "anti-air-battery", "castilla-y-leon");
    const fighters = ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9"];
    for (const id of fighters) doomed = withRaised(doomed, id, "north", "fighter-squadron", "castilla-y-leon");
    const result = resolveTurn(scenario, doomed, submit(
      raid("republic", "rep-breguet-bombers", "burgos"),
      ...fighters.map((id) => mission("north", id, { kind: "intercept", territoryId: territory("castilla-y-leon") }))
    ), seed);
    expect(raidOf(result.outcomes)).toMatchObject({ aircraftLost: ["rep-breguet-bombers"], result: "air-eliminated" });
    expect(result.finalState.units[unit("rep-breguet-bombers")]).toBeUndefined();
  });

  it("cuts the target's income for one turn through the incomeDelta hook", () => {
    const cut: GameState = { ...state, raidCuts: [{ subTerritoryId: "valladolid" as SubTerritoryId, turnNumber: 1 }] };
    // Valladolid: farms 3 (Manpower) and industry 1 (Funds), and the North holds Castilla y Leon whole.
    expect(raidIncomeDelta({ factionId: faction("north"), income: {}, scenario, state: cut })).toEqual({ funds: -1, manpower: -3 });
    expect(raidIncomeDelta({ factionId: faction("republic"), income: {}, scenario, state: cut })).toEqual({});
    expect(raidIncomeDelta({ factionId: faction("north"), income: {}, scenario, state: { ...cut, turnNumber: 2 } })).toEqual({});
  });

  it("writes an income cut for the next turn, and drops it once that turn's income is paid", () => {
    for (let trial = 1; trial < 200; trial += 1) {
      if (raidResult(scenario, pick(rollStream(trial, "raid", 1, 0), 20)) !== "income-cut") continue;
      const first = resolveTurn(scenario, state, submit(raid("republic", "rep-breguet-bombers", "burgos")), trial);
      expect(first.finalState.raidCuts).toEqual([{ subTerritoryId: "burgos", turnNumber: 2 }]);
      const second = resolveTurn(scenario, { ...first.finalState, turnNumber: 2 }, [], trial);
      expect(second.finalState.raidCuts).toEqual([]);
      return;
    }
    throw new Error("no seed gave an income cut");
  });

  it("downgrades or destroys a building on a building-hit result", () => {
    for (let trial = 1; trial < 200; trial += 1) {
      if (raidResult(scenario, pick(rollStream(trial, "raid", 1, 0), 20)) !== "building-hit") continue;
      const result = resolveTurn(scenario, state, submit(raid("republic", "rep-breguet-bombers", "burgos")), trial);
      const flown = raidOf(result.outcomes);
      expect(flown?.buildingId).toBeDefined();
      expect(result.finalState.subTerritories["burgos" as SubTerritoryId]?.buildings).toHaveLength(2);
      return;
    }
    throw new Error("no seed gave a building hit");
  });
});

describe("recon, support, grounding and rebasing (U2, U4, D7)", () => {
  const scenario = spain();
  const state = initialGameState(scenario);

  it("reveals the target territory to the viewer until the next turn", () => {
    const result = resolveTurn(scenario, state, submit(mission("republic", "rep-catalan-recon", { kind: "recon", territoryId: territory("aragon") })), seed);
    expect(result.finalState.reveals).toEqual([{ territoryId: "aragon", untilTurn: 2, viewerFactionId: "republic" }]);
    expect(kinds(result.outcomes)).toContain("recon");
  });

  it("adds its bombers' support to the battle in the territory, for its side", () => {
    const attack = ["rep-wad-ras-1", "rep-covadonga-4", "rep-madrid-security"].map((id) => move("republic", id, "madrid", "castilla-y-leon"));
    const support = mission("republic", "rep-breguet-bombers", { kind: "support", territoryId: territory("castilla-y-leon") });
    const result = resolveTurn(scenario, state, [{ factionId: faction("republic"), orders: [...attack, support] }], seed);
    const battle = result.outcomes.find((outcome) => outcome.kind === "battle");
    expect(battle?.modifiers).toContainEqual({ factionId: "republic", kind: "air-support", role: "attack", roll: 2, unitIds: ["rep-breguet-bombers"] });
    expect(result.outcomes.find((outcome) => outcome.kind === "air-support")).toMatchObject({ battleIndex: 0, territoryId: "castilla-y-leon" });
  });

  it("keeps aircraft out of the ground battles", () => {
    const attack = ["north-san-marcial-22", "north-san-quintin-25", "north-la-victoria-28"].map((id) => move("north", id, "castilla-y-leon", "madrid"));
    const result = resolveTurn(scenario, state, [{ factionId: faction("north"), orders: attack }], seed);
    const battle = result.outcomes.find((outcome) => outcome.kind === "battle");
    const defenders = battle?.defender.armies.map((army) => army.unitId) ?? [];
    expect(defenders).not.toContain("rep-breguet-bombers");
    expect(defenders).not.toContain("rep-general-miaja");
    expect(defenders).toContain("rep-wad-ras-1");
  });

  it("stays on the ground when the grounded hook says so (weather, T4)", () => {
    const weather: RuleModule = { area: "weather", blocks: [], hooks: { grounded: () => true }, id: "test-grounding", steps: {} };
    const grounded: Scenario = { ...scenario, modules: [...scenario.modules, weather] };
    const result = resolveTurn(grounded, state, submit(raid("republic", "rep-breguet-bombers", "burgos")), seed);
    expect(kinds(result.outcomes)).toContain("grounded");
    expect(kinds(result.outcomes)).not.toContain("raid");
  });

  it("rebases an aircraft that lost its airfield to the nearest one in range, or loses it", () => {
    const stranded: GameState = { ...state, units: { ...state.units, [unit("rep-breguet-bombers")]: { ...state.units[unit("rep-breguet-bombers")]!, territoryId: territory("castilla-la-mancha") } } };
    const result = resolveTurn(scenario, stranded, [], seed);
    expect(result.outcomes).toContainEqual({ factionId: "republic", from: "castilla-la-mancha", kind: "aircraft-rebased", to: "madrid", unitId: "rep-breguet-bombers" });
    // With every Republican airfield gone, a stranded aircraft has nowhere to go.
    const bare = Object.fromEntries(Object.entries(state.subTerritories).map(([id, sub]) =>
      [id, sub.holder === faction("republic") ? { ...sub, buildings: sub.buildings.filter((building) => !building.includes("airfield")) } : sub]));
    const far: GameState = withRaised({ ...state, subTerritories: bare }, "lone-recon", "republic", "recon-flight", "ceuta");
    const lost = resolveTurn(scenario, far, [], seed);
    expect(lost.outcomes).toContainEqual({ factionId: "republic", from: "ceuta", kind: "aircraft-lost", unitId: "lone-recon" });
    expect(lost.finalState.units["lone-recon" as UnitId]).toBeUndefined();
  });
});
