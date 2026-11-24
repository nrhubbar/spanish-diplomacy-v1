import { describe, expect, it } from "vitest";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type { GameState, TurnOutcome, VictoryProgress } from "../main/engine/types";
import { legalDestinations, validateMoveOrder, validateSubmission } from "../main/engine/validation";
import { evaluateVictory, victoryProgress, victoryThresholds } from "../main/engine/victory";
import { armyIn, battlesOf, city, faction, loadedDice, move, spainM2, territory, tiny, unit, withUnits } from "./support";
import { pinned, popularResistance } from "./pinned";

const kinds = (outcomes: readonly TurnOutcome[]) => outcomes.map((outcome) => outcome.kind);

describe("order validation (M1, M2)", () => {
  it("accepts connected moves and explains every rejection", () => {
    const scenario = tiny();
    const state = initialGameState(scenario);
    expect(validateMoveOrder(scenario, state, move("red", "red-guard", "westfold", "highlands"))).toEqual({ ok: true });
    expect(validateMoveOrder(scenario, state, move("red", "missing", "westfold", "highlands"))).toMatchObject({ reason: "Unknown unit." });
    expect(validateMoveOrder(scenario, state, move("blue", "red-guard", "westfold", "highlands"))).toMatchObject({ ok: false });
    expect(validateMoveOrder(scenario, state, move("red", "red-guard", "highlands", "harbor"))).toMatchObject({ ok: false });
    expect(validateMoveOrder(scenario, state, move("red", "red-guard", "westfold", "westfold"))).toMatchObject({ reason: expect.stringContaining("different") });
    expect(validateMoveOrder(scenario, state, move("red", "red-guard", "westfold", "harbor"))).toMatchObject({ reason: expect.stringContaining("not connected") });
  });

  it("validates whole submissions, including duplicates and ownership", () => {
    const scenario = tiny();
    const state = initialGameState(scenario);
    const order = move("red", "red-guard", "westfold", "highlands");
    expect(validateSubmission(scenario, state, faction("red"), { factionId: faction("red"), orders: [order] })).toEqual({ ok: true });
    expect(validateSubmission(scenario, state, faction("red"), { factionId: faction("red"), orders: [order, order] })).toMatchObject({ ok: false });
    expect(validateSubmission(scenario, state, faction("blue"), { factionId: faction("red"), orders: [] })).toMatchObject({ ok: false });
    expect(validateSubmission(scenario, state, faction("red"), { factionId: faction("red"), orders: [move("red", "red-guard", "westfold", "harbor")] })).toMatchObject({ ok: false });
  });

  it("lists destinations legal for every selected unit, including sea connections", () => {
    const scenario = tiny();
    const state = withUnits(scenario, [["a", "blue", "harbor"], ["b", "blue", "harbor"], ["c", "blue", "lowlands"]]);
    expect(legalDestinations(scenario, state, faction("blue"), [unit("a"), unit("b")])).toEqual(["highlands", "lowlands", "isle"]);
    expect(legalDestinations(scenario, state, faction("blue"), [unit("a"), unit("c")])).toEqual([]);
    expect(legalDestinations(scenario, state, faction("blue"), [])).toEqual([]);
  });
});

describe("starting state (C4, C6, C7, C13)", () => {
  it("starts every army at its snapshot strength, in good morale, with no works dug", () => {
    const state = initialGameState(tiny());
    expect(state.units[unit("red-guard")]).toMatchObject({ morale: { demoralized: false, quietTurns: 0 }, strength: 500 });
    expect(state.units[unit("red-rangers")]?.strength).toBe(300);
    expect(state.fortification).toEqual({});
    for (const definition of spainM2().units) {
      expect(initialGameState(spainM2()).units[definition.id]?.strength).toBe(definition.strength);
    }
  });

  it("carries men and morale with a moving army, and works stay with the territory (M22, M23, C13)", () => {
    const scenario = tiny();
    const start = initialGameState(scenario);
    const state: GameState = {
      ...start,
      fortification: { [territory("westfold")]: { factionId: faction("red"), level: 1 } },
      units: { ...start.units, [unit("red-guard")]: { ...armyIn(start, "red-guard"), morale: { demoralized: true, quietTurns: 0 }, strength: 250 } }
    };
    const result = resolveTurn(scenario, state, [{ factionId: faction("red"), orders: [move("red", "red-guard", "westfold", "lowlands")] }], 1);
    // The army keeps its men; moving is not quiet, so its recovery clock restarts.
    expect(result.finalState.units[unit("red-guard")]).toEqual({
      factionId: "red", fatigue: 0, id: "red-guard", morale: { demoralized: true, quietTurns: 0 }, strength: 250, territoryId: "lowlands"
    });
    expect(result.finalState.units[unit("red-rangers")]).toBe(state.units[unit("red-rangers")]);
    // Red no longer holds Westfold, so its works go; it held the Highlands all turn, so they dig in.
    expect(result.finalState.fortification).toEqual({
      [territory("highlands")]: { factionId: "red", level: 1 },
      [territory("harbor")]: { factionId: "blue", level: 1 }
    });
  });
});

describe("turn resolution (single-step movement)", () => {
  it("moves friendly units into the same destination together", () => {
    const scenario = tiny();
    const state = withUnits(scenario, [["a", "red", "westfold"], ["b", "red", "westfold"]]);
    const result = resolveTurn(scenario, state, [{ factionId: faction("red"), orders: [move("red", "a", "westfold", "lowlands"), move("red", "b", "westfold", "lowlands")] }], 1);
    expect(kinds(result.outcomes).slice(0, 2)).toEqual(["successful-move", "successful-move"]);
    expect(result.finalState.control[territory("lowlands")]).toEqual({ factionId: "red", kind: "controlled" });
    expect(result.controlChanges).toEqual([{ after: { factionId: "red", kind: "controlled" }, before: { factionId: "blue", kind: "controlled" }, territoryId: "lowlands" }]);
  });

  it("lets a faction reinforce a shared territory despite stationary hostiles (M11, OD-7)", () => {
    const scenario = spainM2();
    const state = initialGameState(scenario);
    // Andalucia (battle 0), Asturias, Extremadura, the Balearics and Pais Vasco are shared, so each has a standing battle (M27).
    const result = resolveTurn(scenario, state, [
      { factionId: faction("south"), orders: [move("south", "south-legion", "ceuta", "andalucia")] }
    ], 1, loadedDice([2, 11, 11, 11, 8, 11]));
    expect(result.outcomes[0]).toEqual({ kind: "reinforcement-arrived", order: move("south", "south-legion", "ceuta", "andalucia") });
    expect(result.finalState.units[unit("south-legion")]?.territoryId).toBe("andalucia");
    expect(result.finalState.control[territory("andalucia")]?.kind).toBe("contested");
  });

  it("makes an unopposed move into an empty contested territory controlled (M6)", () => {
    const scenario = spainM2();
    // Without the Palma and Mahon garrisons the Balearics are contested and empty.
    const start = initialGameState(scenario);
    const state = { ...start, units: Object.fromEntries(Object.entries(start.units).filter(([id]) => id !== "south-palma-36" && id !== "rep-baleares-37")) };
    const result = resolveTurn(scenario, state, [
      { factionId: faction("republic"), orders: [move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha"), move("republic", "rep-otumba-9", "valencia", "islas-baleares")] }
    ], 1);
    expect(result.outcomes[0]?.kind).toBe("reinforcement-arrived");
    expect(result.outcomes[1]?.kind).toBe("successful-move");
    expect(result.finalState.control[territory("islas-baleares")]).toEqual({ factionId: "republic", kind: "controlled" });
  });

  it("never changes control by holding where no territory is shared (OD-8)", () => {
    const scenario = tiny();
    const result = resolveTurn(scenario, initialGameState(scenario), [], 1);
    expect(result.controlChanges).toEqual([]);
    expect(result.cityChanges).toEqual([]);
    expect(battlesOf(result)).toEqual([]);
  });

  it("fights only the standing battles when every Spanish faction holds (OD-8 under M27)", () => {
    // Changed in Revision 6: shared territories now fight each turn, so holding is no longer
    // guaranteed to leave the historical start unchanged.
    const scenario = popularResistance(pinned(spainM2()));
    const result = resolveTurn(scenario, initialGameState(scenario), [], 1, loadedDice([8, 11, 11, 14, 11, 8]));
    expect(battlesOf(result).map((battle) => [battle.site.kind, "territoryId" in battle.site ? battle.site.territoryId : ""])).toEqual([
      ["standing", "andalucia"],
      // R2: the Barbastro garrison holds eastern Huesca against Zaragoza's regiments.
      ["standing", "aragon"],
      ["standing", "asturias"],
      ["standing", "extremadura"],
      ["standing", "islas-baleares"],
      ["standing", "pais-vasco"]
    ]);
    expect(battlesOf(result).map((battle) => battle.grade)).toEqual(["stalemate", "stalemate", "stalemate", "attacker-repulsed", "attacker-repulsed", "attacker-repulsed"]);
    expect(result.controlChanges).toEqual([]);
    expect(result.finalState.control[territory("aragon")]?.kind).toBe("contested");
  });

  it("resolves a contest when the other side leaves (B6) and occupies its cities (B5)", () => {
    const scenario = spainM2();
    const state = initialGameState(scenario);
    const result = resolveTurn(scenario, state, [
      { factionId: faction("north"), orders: [move("north", "north-milan-32", "asturias", "galicia"), move("north", "north-simancas-40", "asturias", "galicia"), move("north", "north-oviedo-guards", "asturias", "galicia")] }
    ], 1, loadedDice([11, 11, 8, 8, 8]));
    expect(kinds(result.outcomes).slice(0, 2)).toEqual(["reinforcement-arrived", "reinforcement-arrived"]);
    expect(result.finalState.control[territory("asturias")]).toEqual({ factionId: "republic", kind: "controlled" });
    expect(result.finalState.cityControl[city("oviedo")]).toBe("republic");
    expect(result.cityChanges).toContainEqual({ after: "republic", before: "north", cityId: "oviedo" });
  });

  it("leaves cities unchanged while two factions still share a territory", () => {
    const scenario = spainM2();
    const state = initialGameState(scenario);
    const result = resolveTurn(scenario, state, [
      { factionId: faction("north"), orders: [move("north", "north-milan-32", "asturias", "galicia")] }
    ], 1, loadedDice([8, 11, 14, 8, 8, 8]));
    expect(battlesOf(result).map((battle) => battle.grade).slice(0, 2)).toEqual(["stalemate", "stalemate"]);
    expect(result.finalState.cityControl[city("oviedo")]).toBe("north");
    expect(result.finalState.control[territory("asturias")]?.kind).toBe("contested");
  });

  it("disbands units with impossible or duplicate orders (M9) and reports holds", () => {
    const scenario = tiny();
    const state = withUnits(scenario, [["r", "red", "westfold"], ["b", "blue", "harbor"]]);
    const result = resolveTurn(scenario, state, [
      { factionId: faction("red"), orders: [move("red", "r", "westfold", "lowlands"), move("red", "r", "westfold", "highlands")] }
    ], 1);
    expect(kinds(result.outcomes)).toEqual(["invalid-order", "invalid-order", "no-move"]);
    expect(result.finalState.units[unit("r")]).toBeUndefined();
    const noUnits = resolveTurn(scenario, withUnits(scenario, []), [], 1);
    expect(noUnits.outcomes).toEqual([{ factionId: "red", kind: "no-move" }, { factionId: "blue", kind: "no-move" }]);
  });
});

describe("victory (M10)", () => {
  const entry = (id: string, territoriesControlled: number, citiesControlled: number): VictoryProgress => ({
    cityThreshold: 19, citiesControlled, factionId: faction(id), territoriesControlled, territoryThreshold: 10
  });

  it("derives thresholds from scenario data", () => {
    expect(victoryThresholds(spainM2())).toEqual({ cities: 19, territories: 10 });
    expect(victoryThresholds(tiny())).toEqual({ cities: 2, territories: 3 });
  });

  it("applies the tie-break order and records shared victories", () => {
    const order = ["cities", "territories"] as const;
    expect(evaluateVictory([entry("a", 10, 5)], order)).toEqual({ condition: "territories", factionIds: ["a"] });
    expect(evaluateVictory([entry("a", 3, 19)], order)).toEqual({ condition: "cities", factionIds: ["a"] });
    expect(evaluateVictory([entry("a", 10, 19), entry("b", 11, 19)], order)).toEqual({ condition: "cities", factionIds: ["b"] });
    expect(evaluateVictory([entry("a", 10, 19), entry("b", 10, 19)], order)).toEqual({ condition: "shared", factionIds: ["a", "b"] });
    expect(evaluateVictory([entry("a", 3, 2)], order)).toBeUndefined();
  });

  it("awards victory inside resolution", () => {
    const scenario = tiny();
    const state = withUnits(scenario, [["r", "red", "highlands"]]);
    const result = resolveTurn(scenario, state, [{ factionId: faction("red"), orders: [move("red", "r", "highlands", "harbor")] }], 1);
    expect(result.victory).toEqual({ condition: "territories", factionIds: ["red"] });
    expect(victoryProgress(scenario, result.finalState)[0]).toMatchObject({ territoriesControlled: 3 });
  });
});
