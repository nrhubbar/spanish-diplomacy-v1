import { describe, expect, it } from "vitest";
import { generateComputerSubmission, legalMoves } from "../main/ai/computerPlayer";
import { deriveSeed, seededRandom } from "../main/engine/random";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type { TurnOutcome, VictoryProgress } from "../main/engine/types";
import { legalDestinations, validateMoveOrder, validateSubmission } from "../main/engine/validation";
import { evaluateVictory, victoryProgress, victoryThresholds } from "../main/engine/victory";
import { city, faction, move, spain, territory, tiny, unit, withUnits } from "./support";

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

describe("turn resolution (m2-movement)", () => {
  it("moves friendly units into the same destination together (M3)", () => {
    const scenario = tiny();
    const state = withUnits(scenario, [["a", "red", "westfold"], ["b", "red", "westfold"]]);
    const result = resolveTurn(scenario, state, [{ factionId: faction("red"), orders: [move("red", "a", "westfold", "lowlands"), move("red", "b", "westfold", "lowlands")] }]);
    expect(kinds(result.outcomes).slice(0, 2)).toEqual(["successful-move", "successful-move"]);
    expect(result.finalState.control[territory("lowlands")]).toEqual({ factionId: "red", kind: "controlled" });
    expect(result.controlChanges).toEqual([{ after: { factionId: "red", kind: "controlled" }, before: { factionId: "blue", kind: "controlled" }, territoryId: "lowlands" }]);
  });

  it("bounces a standoff and names the opposing factions (M3)", () => {
    const scenario = tiny();
    const state = withUnits(scenario, [["r", "red", "westfold"], ["b", "blue", "harbor"]]);
    const result = resolveTurn(scenario, state, [
      { factionId: faction("red"), orders: [move("red", "r", "westfold", "highlands")] },
      { factionId: faction("blue"), orders: [move("blue", "b", "harbor", "highlands")] }
    ]);
    expect(result.outcomes[0]).toMatchObject({ cause: { kind: "standoff", opposingFactionIds: ["blue"] }, kind: "bounced-move" });
    expect(result.outcomes[1]).toMatchObject({ cause: { kind: "standoff", opposingFactionIds: ["red"] }, kind: "bounced-move" });
  });

  it("bounces a move into a territory a hostile unit holds (M4) and a head-on swap (M5)", () => {
    const scenario = tiny();
    const state = withUnits(scenario, [["r", "red", "highlands"], ["b", "blue", "harbor"]]);
    const held = resolveTurn(scenario, state, [{ factionId: faction("red"), orders: [move("red", "r", "highlands", "harbor")] }]);
    expect(held.outcomes[0]).toMatchObject({ cause: { holdingFactionIds: ["blue"], kind: "held" } });
    const swap = resolveTurn(scenario, state, [
      { factionId: faction("red"), orders: [move("red", "r", "highlands", "harbor")] },
      { factionId: faction("blue"), orders: [move("blue", "b", "harbor", "highlands")] }
    ]);
    expect(swap.outcomes.slice(0, 2).map((outcome) => outcome.kind === "bounced-move" && outcome.cause.kind)).toEqual(["head-on", "head-on"]);
  });

  it("lets a faction reinforce a shared territory despite stationary hostiles (OD-7)", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    const result = resolveTurn(scenario, state, [
      { factionId: faction("south"), orders: [move("south", "south-legion", "ceuta", "andalucia")] }
    ]);
    expect(result.outcomes[0]?.kind).toBe("successful-move");
    expect(result.finalState.units[unit("south-legion")]?.territoryId).toBe("andalucia");
    // Both sides remain present, so the contest is unresolved (M7).
    expect(result.finalState.control[territory("andalucia")]?.kind).toBe("contested");
  });

  it("makes an unopposed move into an empty contested territory controlled (M6)", () => {
    const scenario = spain();
    const result = resolveTurn(scenario, initialGameState(scenario), [
      { factionId: faction("republic"), orders: [move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha")] }
    ]);
    const extremadura = resolveTurn(scenario, result.finalState, [
      { factionId: faction("republic"), orders: [move("republic", "rep-wad-ras-1", "castilla-la-mancha", "extremadura")] }
    ]);
    expect(extremadura.finalState.control[territory("extremadura")]).toEqual({ factionId: "republic", kind: "controlled" });
    expect(extremadura.cityChanges).toEqual([]);
    expect(extremadura.finalState.cityControl[city("badajoz")]).toBe("republic");
  });

  it("never changes the historical start when every faction holds (OD-8)", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    const result = resolveTurn(scenario, state, []);
    expect(result.controlChanges).toEqual([]);
    expect(result.cityChanges).toEqual([]);
    expect(result.finalState.control[territory("aragon")]?.kind).toBe("contested");
  });

  it("resolves a contest when the other side leaves (B6) and occupies its cities (B5)", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    const result = resolveTurn(scenario, state, [
      { factionId: faction("north"), orders: [move("north", "north-milan-32", "asturias", "galicia"), move("north", "north-simancas-40", "asturias", "galicia")] }
    ]);
    expect(result.finalState.control[territory("asturias")]).toEqual({ factionId: "republic", kind: "controlled" });
    expect(result.finalState.cityControl[city("oviedo")]).toBe("republic");
    expect(result.cityChanges).toContainEqual({ after: "republic", before: "north", cityId: "oviedo" });
  });

  it("leaves cities unchanged while two factions share a territory", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    const result = resolveTurn(scenario, state, [
      { factionId: faction("north"), orders: [move("north", "north-milan-32", "asturias", "galicia")] }
    ]);
    expect(result.finalState.cityControl[city("oviedo")]).toBe("north");
    expect(result.finalState.control[territory("asturias")]?.kind).toBe("contested");
  });

  it("disbands a bounced unit only when another faction captures its origin (M8, B17)", () => {
    const scenario = tiny();
    const state = withUnits(scenario, [["r1", "red", "westfold"], ["r2", "red", "lowlands"], ["b1", "blue", "highlands"], ["b2", "blue", "harbor"]]);
    const ownSide = resolveTurn(scenario, state, [
      { factionId: faction("red"), orders: [move("red", "r1", "westfold", "highlands"), move("red", "r2", "lowlands", "westfold")] }
    ]);
    expect(kinds(ownSide.outcomes).slice(0, 2)).toEqual(["bounced-move", "successful-move"]);
    expect(ownSide.finalState.units[unit("r1")]).toBeDefined();

    const captured = resolveTurn(scenario, withUnits(scenario, [["r1", "red", "highlands"], ["b1", "blue", "harbor"], ["b2", "blue", "westfold"]]), [
      { factionId: faction("red"), orders: [move("red", "r1", "highlands", "harbor")] },
      { factionId: faction("blue"), orders: [move("blue", "b2", "westfold", "highlands")] }
    ]);
    expect(captured.outcomes[0]).toMatchObject({ capturedByFactionId: "blue", kind: "disbanded-move" });
    expect(captured.finalState.units[unit("r1")]).toBeUndefined();
  });

  it("disbands units with impossible or duplicate orders (M9) and reports holds", () => {
    const scenario = tiny();
    const state = withUnits(scenario, [["r", "red", "westfold"], ["b", "blue", "harbor"]]);
    const result = resolveTurn(scenario, state, [
      { factionId: faction("red"), orders: [move("red", "r", "westfold", "lowlands"), move("red", "r", "westfold", "highlands")] }
    ]);
    expect(kinds(result.outcomes)).toEqual(["invalid-order", "invalid-order", "no-move"]);
    expect(result.finalState.units[unit("r")]).toBeUndefined();
    const noUnits = resolveTurn(scenario, withUnits(scenario, []), []);
    expect(noUnits.outcomes).toEqual([{ factionId: "red", kind: "no-move" }, { factionId: "blue", kind: "no-move" }]);
  });
});

describe("victory (M10)", () => {
  const entry = (id: string, territoriesControlled: number, citiesControlled: number): VictoryProgress => ({
    cityThreshold: 19, citiesControlled, factionId: faction(id), territoriesControlled, territoryThreshold: 10
  });

  it("derives thresholds from scenario data", () => {
    expect(victoryThresholds(spain())).toEqual({ cities: 19, territories: 10 });
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
    const result = resolveTurn(scenario, state, [{ factionId: faction("red"), orders: [move("red", "r", "highlands", "harbor")] }]);
    expect(result.victory).toEqual({ condition: "territories", factionIds: ["red"] });
    expect(victoryProgress(scenario, result.finalState)[0]).toMatchObject({ territoriesControlled: 3 });
  });
});

describe("computer player", () => {
  it("submits valid, seed-deterministic orders", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    for (const factionDefinition of scenario.factions) {
      const first = generateComputerSubmission(scenario, state, factionDefinition.id, seededRandom(7));
      const second = generateComputerSubmission(scenario, state, factionDefinition.id, seededRandom(7));
      expect(first).toEqual(second);
      expect(validateSubmission(scenario, state, factionDefinition.id, first)).toEqual({ ok: true });
    }
  });

  it("keeps the last defender on a threatened objective (A1)", () => {
    const scenario = spain();
    const state = withUnits(scenario, [["rep", "republic", "madrid"], ["nic", "north", "castilla-y-leon"]]);
    expect(generateComputerSubmission(scenario, state, faction("republic"), seededRandom(1)).orders).toEqual([]);
  });

  it("does not shuttle units between objectives it already holds (A1)", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    const orders = generateComputerSubmission(scenario, state, faction("republic"), seededRandom(3)).orders;
    const shuttles = orders.filter((order) =>
      ["valencia", "catalunya"].includes(order.from) && ["valencia", "catalunya"].includes(order.to)
    );
    expect(shuttles).toEqual([]);
  });

  it("avoids repeating a move that bounced last turn (A2)", () => {
    const scenario = tiny();
    const state = withUnits(scenario, [["b1", "blue", "harbor"], ["b2", "blue", "harbor"], ["r", "red", "highlands"]]);
    const fresh = generateComputerSubmission(scenario, state, faction("blue"), seededRandom(2));
    const [firstOrder] = fresh.orders;
    expect(firstOrder).toBeDefined();
    const remembered = generateComputerSubmission(scenario, state, faction("blue"), seededRandom(2), {
      previousOutcomes: fresh.orders.map((order) => ({ cause: { kind: "held", holdingFactionIds: [faction("red")] }, kind: "bounced-move", order }))
    });
    expect(remembered.orders.map((order) => order.to)).not.toEqual(fresh.orders.map((order) => order.to));
  });

  it("enumerates legal moves and derives independent seeds", () => {
    const scenario = tiny();
    const state = initialGameState(scenario);
    expect(legalMoves(scenario, state, state.units[unit("blue-marines")]!).map((order) => order.to)).toEqual(["highlands", "lowlands", "isle"]);
    expect(deriveSeed(1, 2)).not.toBe(deriveSeed(1, 3));
    const random = seededRandom(42);
    expect(random()).toBeGreaterThanOrEqual(0);
    expect(random()).toBeLessThan(1);
  });
});
