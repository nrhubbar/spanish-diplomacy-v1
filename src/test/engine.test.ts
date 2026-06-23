import { describe, expect, it } from "vitest";
import { resolveTurn } from "../main/engine/resolution";
import type { GameState, Order, ScenarioDefinition, TerritoryId } from "../main/engine/types";
import { validateOrder } from "../main/engine/validation";
import { createInitialGameState, milestone1Scenario } from "../main/scenarios/milestone1Scenario";

describe("milestone1Scenario", () => {
  it("defines the milestone factions, territories, units, and empty center", () => {
    const state = createInitialGameState();

    expect(milestone1Scenario.factions).toHaveLength(3);
    expect(milestone1Scenario.territories.map((territory) => territory.id)).toEqual([
      "north",
      "center",
      "southwest",
      "eastern-port"
    ]);
    expect(Object.values(state.units)).toHaveLength(3);
    expect(Object.values(state.units).some((unit) => unit.territoryId === "center")).toBe(false);
  });
});

describe("validateOrder", () => {
  it("accepts a valid adjacent move", () => {
    const state = createInitialGameState();

    expect(
      validateOrder(milestone1Scenario, state, {
        kind: "move",
        factionId: "player-1",
        unitId: "soldier-1",
        from: "north",
        to: "center"
      })
    ).toEqual({ ok: true });
  });

  it("accepts no move", () => {
    const state = createInitialGameState();

    expect(
      validateOrder(milestone1Scenario, state, {
        kind: "no-move",
        factionId: "player-1",
        unitId: "soldier-1"
      })
    ).toEqual({ ok: true });
  });

  it("rejects a unit controlled by another faction", () => {
    const state = createInitialGameState();

    expect(
      validateOrder(milestone1Scenario, state, {
        kind: "no-move",
        factionId: "player-2",
        unitId: "soldier-1"
      })
    ).toEqual({ ok: false, reason: "Selected unit belongs to another player." });
  });

  it("rejects an unknown unit", () => {
    const state = createInitialGameState();

    expect(
      validateOrder(milestone1Scenario, state, {
        kind: "no-move",
        factionId: "player-1",
        unitId: "missing"
      } as unknown as Order)
    ).toEqual({ ok: false, reason: "Unknown unit." });
  });

  it("rejects a unit that is no longer in the origin territory", () => {
    const state = createInitialGameState();

    expect(
      validateOrder(milestone1Scenario, state, {
        kind: "move",
        factionId: "player-1",
        unitId: "soldier-1",
        from: "southwest",
        to: "center"
      })
    ).toEqual({ ok: false, reason: "Selected unit is no longer in that territory." });
  });

  it("rejects a move from an unknown origin territory", () => {
    const state = {
      ...createInitialGameState(),
      units: {
        ...createInitialGameState().units,
        "soldier-1": {
          ...createInitialGameState().units["soldier-1"],
          territoryId: "missing"
        }
      }
    } as unknown as GameState;

    expect(
      validateOrder(milestone1Scenario, state, {
        kind: "move",
        factionId: "player-1",
        unitId: "soldier-1",
        from: "missing",
        to: "center"
      } as unknown as Order)
    ).toEqual({ ok: false, reason: "Unknown origin territory." });
  });

  it("rejects a non-adjacent move", () => {
    const state = createInitialGameState();
    const scenario = {
      ...milestone1Scenario,
      territories: milestone1Scenario.territories.map((territory) =>
        territory.id === "north"
          ? { ...territory, adjacent: ["southwest" as TerritoryId] }
          : territory
      )
    } satisfies ScenarioDefinition;

    expect(
      validateOrder(scenario, state, {
        kind: "move",
        factionId: "player-1",
        unitId: "soldier-1",
        from: "north",
        to: "center"
      })
    ).toEqual({ ok: false, reason: "Destination is not adjacent." });
  });
});

describe("resolveTurn", () => {
  it("moves into empty center when uncontested", () => {
    const state = createInitialGameState();
    const result = resolveTurn(milestone1Scenario, state, [
      {
        kind: "move",
        factionId: "player-1",
        unitId: "soldier-1",
        from: "north",
        to: "center"
      }
    ]);

    expect(result.finalUnits["soldier-1"].territoryId).toBe("center");
    expect(result.outcomes[0]?.kind).toBe("successful-move");
  });

  it("bounces two units moving into center", () => {
    const state = createInitialGameState();
    const result = resolveTurn(milestone1Scenario, state, [
      {
        kind: "move",
        factionId: "player-1",
        unitId: "soldier-1",
        from: "north",
        to: "center"
      },
      {
        kind: "move",
        factionId: "player-2",
        unitId: "soldier-2",
        from: "southwest",
        to: "center"
      }
    ]);

    expect(result.finalUnits["soldier-1"].territoryId).toBe("north");
    expect(result.finalUnits["soldier-2"].territoryId).toBe("southwest");
    expect(result.outcomes.map((outcome) => outcome.kind)).toEqual([
      "bounced-move",
      "bounced-move"
    ]);
  });

  it("bounces a move into an occupied stationary territory", () => {
    const state = createInitialGameState();
    const result = resolveTurn(milestone1Scenario, state, [
      {
        kind: "move",
        factionId: "player-1",
        unitId: "soldier-1",
        from: "north",
        to: "southwest"
      },
      {
        kind: "no-move",
        factionId: "player-2",
        unitId: "soldier-2"
      }
    ]);

    expect(result.finalUnits["soldier-1"].territoryId).toBe("north");
    expect(result.finalUnits["soldier-2"].territoryId).toBe("southwest");
    expect(result.outcomes[0]?.kind).toBe("bounced-move");
  });

  it("bounces units attempting to swap territories", () => {
    const state = createInitialGameState();
    const result = resolveTurn(milestone1Scenario, state, [
      {
        kind: "move",
        factionId: "player-1",
        unitId: "soldier-1",
        from: "north",
        to: "southwest"
      },
      {
        kind: "move",
        factionId: "player-2",
        unitId: "soldier-2",
        from: "southwest",
        to: "north"
      }
    ]);

    expect(result.finalUnits["soldier-1"].territoryId).toBe("north");
    expect(result.finalUnits["soldier-2"].territoryId).toBe("southwest");
    expect(result.summaryLines).toEqual([
      "player-1 bounced moving from north to southwest: Units attempted to swap territories.",
      "player-2 bounced moving from southwest to north: Units attempted to swap territories."
    ]);
  });

  it("leaves a no-move unit in place", () => {
    const state = createInitialGameState();
    const result = resolveTurn(milestone1Scenario, state, [
      {
        kind: "no-move",
        factionId: "player-1",
        unitId: "soldier-1"
      }
    ]);

    expect(result.finalUnits["soldier-1"].territoryId).toBe("north");
    expect(result.outcomes[0]?.kind).toBe("no-move");
  });

  it("supports mixed success, bounce, and no-move resolution", () => {
    const state = createInitialGameState();
    const result = resolveTurn(milestone1Scenario, state, [
      {
        kind: "move",
        factionId: "player-1",
        unitId: "soldier-1",
        from: "north",
        to: "center"
      },
      {
        kind: "move",
        factionId: "player-2",
        unitId: "soldier-2",
        from: "southwest",
        to: "eastern-port"
      },
      {
        kind: "no-move",
        factionId: "player-3",
        unitId: "soldier-3"
      }
    ]);

    expect(result.outcomes.map((outcome) => outcome.kind)).toEqual([
      "successful-move",
      "bounced-move",
      "no-move"
    ]);
    expect(result.summaryLines).toHaveLength(3);
  });
});
