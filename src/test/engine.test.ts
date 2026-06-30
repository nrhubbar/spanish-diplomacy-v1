import { describe, expect, it } from "vitest";
import { resolveTurn } from "../main/engine/resolution";
import type { GameState, MoveOrder, PlayerSubmission, ScenarioDefinition, TerritoryId } from "../main/engine/types";
import { validateMoveOrder } from "../main/engine/validation";
import { createInitialGameState, milestone1Scenario } from "../main/scenarios/milestone1Scenario";

const move = (
  factionId: MoveOrder["factionId"],
  unitId: string,
  from: TerritoryId,
  to: TerritoryId
): MoveOrder => ({
  factionId,
  from,
  kind: "move",
  to,
  unitId
});

const submit = (submission: PlayerSubmission): PlayerSubmission => submission;

describe("milestone1Scenario", () => {
  it("defines factions, territory control, named units, and empty center", () => {
    const state = createInitialGameState();

    expect(milestone1Scenario.factions.map((faction) => faction.id)).toEqual(["com", "roy", "fas"]);
    expect(Object.values(state.units).map((unit) => unit.id)).toEqual([
      "com-inf-001",
      "roy-inf-001",
      "fas-inf-001"
    ]);
    expect(Object.values(state.units).some((unit) => unit.territoryId === "center")).toBe(false);
    expect(state.control).toEqual({
      north: "com",
      southwest: "roy",
      "eastern-port": "fas"
    });
  });
});

describe("validateMoveOrder", () => {
  it("accepts a valid adjacent move", () => {
    const state = createInitialGameState();

    expect(validateMoveOrder(milestone1Scenario, state, move("com", "com-inf-001", "north", "center"))).toEqual({
      ok: true
    });
  });

  it("rejects wrong faction, unknown unit, wrong origin, unknown origin, and illegal destination", () => {
    const state = createInitialGameState();
    const stateWithBadOrigin = {
      ...state,
      units: {
        ...state.units,
        "com-inf-001": {
          ...state.units["com-inf-001"],
          territoryId: "missing"
        }
      }
    } as unknown as GameState;
    const scenario = {
      ...milestone1Scenario,
      territories: milestone1Scenario.territories.map((territory) =>
        territory.id === "north"
          ? { ...territory, adjacent: ["southwest" as TerritoryId] }
          : territory
      )
    } satisfies ScenarioDefinition;

    expect(validateMoveOrder(milestone1Scenario, state, move("roy", "com-inf-001", "north", "center"))).toEqual({
      ok: false,
      reason: "Selected unit belongs to another player."
    });
    expect(validateMoveOrder(milestone1Scenario, state, move("com", "missing", "north", "center"))).toEqual({
      ok: false,
      reason: "Unknown unit."
    });
    expect(validateMoveOrder(milestone1Scenario, state, move("com", "com-inf-001", "southwest", "center"))).toEqual({
      ok: false,
      reason: "Selected unit is no longer in that territory."
    });
    expect(
      validateMoveOrder(milestone1Scenario, stateWithBadOrigin, move("com", "com-inf-001", "missing" as TerritoryId, "center"))
    ).toEqual({
      ok: false,
      reason: "Unknown origin territory."
    });
    expect(validateMoveOrder(scenario, state, move("com", "com-inf-001", "north", "center"))).toEqual({
      ok: false,
      reason: "Destination is not adjacent."
    });
  });
});

describe("resolveTurn", () => {
  it("moves into empty center when uncontested", () => {
    const state = createInitialGameState();
    const result = resolveTurn(milestone1Scenario, state, [
      submit({ factionId: "com", orders: [move("com", "com-inf-001", "north", "center")] })
    ]);

    expect(result.finalUnits["com-inf-001"]?.territoryId).toBe("center");
    expect(result.finalControl.center).toBe("com");
    expect(result.outcomes[0]?.kind).toBe("successful-move");
  });

  it("keeps an empty contested destination empty", () => {
    const state = createInitialGameState();
    const result = resolveTurn(milestone1Scenario, state, [
      submit({ factionId: "com", orders: [move("com", "com-inf-001", "north", "center")] }),
      submit({ factionId: "roy", orders: [move("roy", "roy-inf-001", "southwest", "center")] })
    ]);

    expect(result.finalUnits["com-inf-001"]?.territoryId).toBe("north");
    expect(result.finalUnits["roy-inf-001"]?.territoryId).toBe("southwest");
    expect(result.finalControl.center).toBeUndefined();
  });

  it("disbands a defender that fails to vacate while the attacker takes the territory", () => {
    const state = createInitialGameState();
    const result = resolveTurn(milestone1Scenario, state, [
      submit({ factionId: "com", orders: [move("com", "com-inf-001", "north", "southwest")] }),
      submit({ factionId: "roy", orders: [move("roy", "roy-inf-001", "southwest", "eastern-port")] }),
      submit({ factionId: "fas", orders: [] })
    ]);

    expect(result.finalUnits["com-inf-001"]?.territoryId).toBe("southwest");
    expect(result.finalUnits["roy-inf-001"]).toBeUndefined();
    expect(result.finalControl.southwest).toBe("com");
    expect(result.summaryLines.join(" ")).toContain("disbanded roy-inf-001");
  });

  it("disbands a bounced attacker whose origin was captured", () => {
    const state = createInitialGameState();
    const result = resolveTurn(milestone1Scenario, state, [
      submit({ factionId: "com", orders: [move("com", "com-inf-001", "north", "center")] }),
      submit({ factionId: "roy", orders: [move("roy", "roy-inf-001", "southwest", "north")] }),
      submit({ factionId: "fas", orders: [move("fas", "fas-inf-001", "eastern-port", "center")] })
    ]);

    expect(result.finalUnits["com-inf-001"]).toBeUndefined();
    expect(result.finalUnits["roy-inf-001"]?.territoryId).toBe("north");
    expect(result.finalUnits["fas-inf-001"]?.territoryId).toBe("eastern-port");
    expect(result.finalControl.north).toBe("roy");
  });

  it("bounces units attempting a head-on swap", () => {
    const state = createInitialGameState();
    const result = resolveTurn(milestone1Scenario, state, [
      submit({ factionId: "com", orders: [move("com", "com-inf-001", "north", "southwest")] }),
      submit({ factionId: "roy", orders: [move("roy", "roy-inf-001", "southwest", "north")] })
    ]);

    expect(result.finalUnits["com-inf-001"]?.territoryId).toBe("north");
    expect(result.finalUnits["roy-inf-001"]?.territoryId).toBe("southwest");
    expect(result.summaryLines.join(" ")).toContain("Units attempted to swap territories.");
  });

  it("allows three-unit cycles", () => {
    const state = createInitialGameState();
    const result = resolveTurn(milestone1Scenario, state, [
      submit({ factionId: "com", orders: [move("com", "com-inf-001", "north", "center")] }),
      submit({ factionId: "roy", orders: [move("roy", "roy-inf-001", "southwest", "north")] }),
      submit({ factionId: "fas", orders: [move("fas", "fas-inf-001", "eastern-port", "southwest")] })
    ]);

    expect(result.finalUnits["com-inf-001"]?.territoryId).toBe("center");
    expect(result.finalUnits["roy-inf-001"]?.territoryId).toBe("north");
    expect(result.finalUnits["fas-inf-001"]?.territoryId).toBe("southwest");
  });

  it("disbands units with impossible submitted orders", () => {
    const state = createInitialGameState();
    const result = resolveTurn(milestone1Scenario, state, [
      submit({
        factionId: "com",
        orders: [move("com", "com-inf-001", "southwest", "center")]
      })
    ]);

    expect(result.finalUnits["com-inf-001"]).toBeUndefined();
    expect(result.outcomes[0]?.kind).toBe("invalid-order");
  });

  it("handles missing submissions as no move", () => {
    const state = createInitialGameState();
    const result = resolveTurn(milestone1Scenario, state, []);

    expect(result.outcomes.map((outcome) => outcome.kind)).toEqual(["no-move", "no-move", "no-move"]);
    expect(result.finalUnits["com-inf-001"]?.territoryId).toBe("north");
  });
});
