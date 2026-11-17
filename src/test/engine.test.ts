import { describe, expect, it } from "vitest";
import { generateComputerSubmission, legalMovesForUnit } from "../main/ai/historicallyMotivatedActor";
import { resolveTurn } from "../main/engine/resolution";
import { validateSubmission } from "../main/engine/submission";
import type { FactionId, GameState, MoveOrder, TerritoryId, VictoryProgress } from "../main/engine/types";
import { validateMoveOrder } from "../main/engine/validation";
import { evaluateVictory, victoryProgress } from "../main/engine/victory";
import { createInitialGameState, milestone2Scenario } from "../main/scenarios/milestone2Scenario";

function move(factionId: FactionId, unitId: string, from: TerritoryId, to: TerritoryId): MoveOrder {
  return { factionId, from, kind: "move", to, unitId };
}

function smallState(): GameState {
  const base = createInitialGameState();
  return {
    ...base,
    units: {
      rep: { ...base.units["rep-wad-ras-1"]!, id: "rep", territoryId: "madrid" },
      north: { ...base.units["north-san-marcial-22"]!, id: "north", territoryId: "castilla-y-leon" },
      south: { ...base.units["south-granada-6"]!, id: "south", territoryId: "andalucia" }
    }
  };
}

describe("historical scenario", () => {
  it("contains researched commands, cities, contested regions, and formation provenance", () => {
    const state = createInitialGameState();
    expect(milestone2Scenario.id).toBe("spain-1936-07-31");
    expect(milestone2Scenario.factions.map((faction) => faction.id)).toEqual(["republic", "north", "south"]);
    expect(milestone2Scenario.cities).toHaveLength(25);
    expect(state.control.andalucia.kind).toBe("contested");
    expect(Object.values(state.units).length).toBeGreaterThan(20);
    expect(Object.values(state.units).every((unit) => unit.sourceIds.length > 0)).toBe(true);
    expect(victoryProgress(milestone2Scenario, state).every((entry) => entry.territoriesControlled < entry.territoryThreshold && entry.citiesControlled < entry.cityThreshold)).toBe(true);
  });
});

describe("validation and independent orders", () => {
  it("validates adjacent movement and rejects integrity errors", () => {
    const state = smallState();
    expect(validateMoveOrder(milestone2Scenario, state, move("republic", "rep", "madrid", "castilla-la-mancha"))).toEqual({ ok: true });
    expect(validateMoveOrder(milestone2Scenario, state, move("north", "rep", "madrid", "castilla-la-mancha"))).toMatchObject({ ok: false });
    expect(validateMoveOrder(milestone2Scenario, state, move("republic", "missing", "madrid", "castilla-la-mancha"))).toMatchObject({ ok: false });
    expect(validateMoveOrder(milestone2Scenario, state, move("republic", "rep", "galicia", "asturias"))).toMatchObject({ ok: false });
    expect(validateMoveOrder(milestone2Scenario, state, move("republic", "rep", "madrid", "galicia"))).toMatchObject({ ok: false });
  });

  it("accepts multiple unit orders but rejects duplicate unit and wrong-faction submissions", () => {
    const state = createInitialGameState();
    const first = move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha");
    const second = move("republic", "rep-covadonga-4", "madrid", "castilla-la-mancha");
    expect(validateSubmission(milestone2Scenario, state, "republic", { factionId: "republic", orders: [first, second] })).toEqual({ ok: true });
    expect(validateSubmission(milestone2Scenario, state, "republic", { factionId: "republic", orders: [first, first] })).toMatchObject({ ok: false });
    expect(validateSubmission(milestone2Scenario, state, "north", { factionId: "republic", orders: [] })).toMatchObject({ ok: false });
    expect(validateSubmission(milestone2Scenario, state, "republic", { factionId: "republic", orders: [move("republic", "rep-wad-ras-1", "madrid", "galicia")] })).toMatchObject({ ok: false });
  });
});

describe("historically motivated computer player", () => {
  it("generates valid objective-seeking orders and is independent of hidden submissions", () => {
    const state = smallState();
    const first = generateComputerSubmission(milestone2Scenario, state, "north", () => 0);
    const second = generateComputerSubmission(milestone2Scenario, structuredClone(state), "north", () => 0);
    expect(validateSubmission(milestone2Scenario, state, "north", first)).toEqual({ ok: true });
    expect(first).toEqual(second);
    expect(milestone2Scenario.factions.find((faction) => faction.id === "north")?.objectiveTerritoryIds).toContain(first.orders[0]?.to);
  });

  it("enumerates legal moves and handles unknown or unitless factions", () => {
    const state = smallState();
    expect(legalMovesForUnit(milestone2Scenario, state, state.units["rep"]!)).toHaveLength(2);
    const noUnits = { ...state, units: {} };
    expect(generateComputerSubmission(milestone2Scenario, noUnits, "south", () => 0)).toEqual({ factionId: "south", orders: [] });
    expect(() => generateComputerSubmission(milestone2Scenario, state, "missing" as FactionId)).toThrow("Unknown computer faction");
  });
});

describe("turn resolution", () => {
  it("moves friendly formations independently into the same destination", () => {
    const state = createInitialGameState();
    const result = resolveTurn(milestone2Scenario, state, [{
      factionId: "republic",
      orders: [
        move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha"),
        move("republic", "rep-covadonga-4", "madrid", "castilla-la-mancha")
      ]
    }]);
    expect(result.finalUnits["rep-wad-ras-1"]?.territoryId).toBe("castilla-la-mancha");
    expect(result.finalUnits["rep-covadonga-4"]?.territoryId).toBe("castilla-la-mancha");
    expect(result.finalControl["castilla-la-mancha"]).toEqual({ kind: "controlled", factionId: "republic" });
  });

  it("bounces hostile incoming moves and head-on swaps", () => {
    const state = smallState();
    const contested = resolveTurn(milestone2Scenario, state, [
      { factionId: "republic", orders: [move("republic", "rep", "madrid", "castilla-la-mancha")] },
      { factionId: "south", orders: [move("south", "south", "andalucia", "castilla-la-mancha")] }
    ]);
    expect(contested.outcomes.filter((outcome) => outcome.kind === "bounced-move")).toHaveLength(2);

    const swapped = resolveTurn(milestone2Scenario, state, [
      { factionId: "republic", orders: [move("republic", "rep", "madrid", "castilla-y-leon")] },
      { factionId: "north", orders: [move("north", "north", "castilla-y-leon", "madrid")] }
    ]);
    expect(swapped.summaryLines.join(" ")).toContain("swap territories");
  });

  it("handles holds, invalid orders, captures, city control, and disbands", () => {
    const state = smallState();
    const result = resolveTurn(milestone2Scenario, state, [
      { factionId: "republic", orders: [move("republic", "rep", "madrid", "galicia")] },
      { factionId: "north", orders: [move("north", "north", "castilla-y-leon", "madrid")] },
      { factionId: "south", orders: [] }
    ]);
    expect(result.finalUnits["rep"]).toBeUndefined();
    expect(result.cityControl["madrid"]).toBe("republic");
    expect(result.summaryLines.join(" ")).toContain("Impossible order");
    expect(result.summaryLines.join(" ")).toContain("held in place");

    const capture = resolveTurn(milestone2Scenario, state, [
      { factionId: "south", orders: [move("south", "south", "andalucia", "castilla-la-mancha")] }
    ]);
    expect(capture.cityControl["albacete"]).toBe("south");
  });

  it("describes a faction with no units and no submitted orders", () => {
    const empty = { ...smallState(), units: {} };
    const result = resolveTurn(milestone2Scenario, empty, []);
    expect(result.summaryLines).toContain("Republican Government submitted no orders.");
    expect(result.summaryLines).toContain("Northern Insurgent Command submitted no orders.");
    expect(result.summaryLines).toContain("Southern Insurgent Command submitted no orders.");
  });
});

describe("victory", () => {
  const progress = (factionId: FactionId, territoriesControlled: number, citiesControlled: number): VictoryProgress => ({
    factionId, territoriesControlled, citiesControlled, territoryThreshold: 10, cityThreshold: 19
  });

  it("awards territory, city, shared, and no victory outcomes", () => {
    expect(evaluateVictory([progress("republic", 10, 5)] )).toEqual({ condition: "territories", factionIds: ["republic"] });
    expect(evaluateVictory([progress("north", 3, 19)] )).toEqual({ condition: "cities", factionIds: ["north"] });
    expect(evaluateVictory([progress("north", 10, 19), progress("south", 10, 19)])).toEqual({ condition: "shared", factionIds: ["north", "south"] });
    expect(evaluateVictory([progress("south", 3, 2)])).toBeUndefined();
  });
});
