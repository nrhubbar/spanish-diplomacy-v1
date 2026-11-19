import { describe, expect, it } from "vitest";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import { isMoveOrder, isUnitOrder, type Order, type UnitTypeId } from "../main/engine/types";
import { unavailableOrderReason, validateSubmission } from "../main/engine/validation";
import { describeOutcome } from "../main/presentation/text";
import { faction, move, territory, tiny, unit } from "./support";

const recruit: Order = { factionId: faction("red"), kind: "recruit", territoryId: territory("westfold"), unitTypeId: "foot" as UnitTypeId };
const replenish: Order = { factionId: faction("red"), kind: "replenish", unitId: unit("red-guard") };

describe("the flat order union (E8)", () => {
  it("tells unit orders and moves apart", () => {
    expect([recruit, replenish, move("red", "red-guard", "westfold", "lowlands")].map((order) => [isMoveOrder(order), isUnitOrder(order)])).toEqual([
      [false, false],
      [false, true],
      [true, true]
    ]);
  });

  it("rejects orders no module handles yet, without disbanding anything (M9, section 2 step 1)", () => {
    const scenario = tiny();
    const state = initialGameState(scenario);
    const result = resolveTurn(scenario, state, [{ factionId: faction("red"), orders: [recruit, replenish] }], 1);
    const rejected = result.outcomes.filter((outcome) => outcome.kind === "rejected-order");
    expect(rejected).toEqual([
      { kind: "rejected-order", order: recruit, reason: unavailableOrderReason },
      { kind: "rejected-order", order: replenish, reason: unavailableOrderReason }
    ]);
    expect(Object.keys(result.finalState.units)).toEqual(Object.keys(state.units));
    expect(describeOutcome(scenario, rejected[0]!)).toBe(`Red League: an order was not carried out: ${unavailableOrderReason}`);
    expect(result.submittedOrders).toEqual([recruit, replenish]);
  });

  it("treats a unit with a move and another order as ordered twice", () => {
    const scenario = tiny();
    const orders = [move("red", "red-guard", "westfold", "lowlands"), replenish];
    const result = resolveTurn(scenario, initialGameState(scenario), [{ factionId: faction("red"), orders }], 1);
    expect(result.outcomes.filter((outcome) => outcome.kind === "invalid-order" || outcome.kind === "rejected-order").map((outcome) => outcome.kind))
      .toEqual(["invalid-order", "rejected-order"]);
    expect(validateSubmission(scenario, initialGameState(scenario), faction("red"), { factionId: faction("red"), orders }))
      .toEqual({ ok: false, reason: "A unit can receive only one order per turn." });
  });

  it("accepts a one-leg path along the connection and nothing longer, until movement lands (M2)", () => {
    const scenario = tiny();
    const state = initialGameState(scenario);
    const step = { ...move("red", "red-guard", "westfold", "lowlands"), legs: [{ kind: "land" as const, to: territory("lowlands") }] };
    const rail = { ...step, legs: [{ kind: "rail" as const, to: territory("lowlands") }] };
    const result = resolveTurn(scenario, state, [{ factionId: faction("red"), orders: [step] }], 1);
    expect(result.outcomes.some((outcome) => outcome.kind === "successful-move")).toBe(true);
    expect(validateSubmission(scenario, state, faction("red"), { factionId: faction("red"), orders: [rail] })).toEqual({ ok: false, reason: unavailableOrderReason });
    expect(validateSubmission(scenario, state, faction("red"), { factionId: faction("red"), orders: [recruit] })).toEqual({ ok: false, reason: unavailableOrderReason });
  });
});
