import { describe, expect, it } from "vitest";
import { resolveTurn } from "../main/engine/resolution";
import type {
  GameState,
  MoveOrder,
  PlayerSubmission,
  TerritoryId
} from "../main/engine/types";
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

function stateWithComAt(territoryId: TerritoryId): GameState {
  const state = createInitialGameState();

  return {
    ...state,
    units: {
      ...state.units,
      "com-inf-001": {
        ...state.units["com-inf-001"]!,
        territoryId
      }
    }
  };
}

function stateWithPositions(
  com: TerritoryId,
  roy: TerritoryId,
  fas: TerritoryId
): GameState {
  const state = createInitialGameState();

  return {
    ...state,
    control: {
      [com]: "com",
      [roy]: "roy",
      [fas]: "fas"
    },
    units: {
      "com-inf-001": {
        ...state.units["com-inf-001"]!,
        territoryId: com
      },
      "roy-inf-001": {
        ...state.units["roy-inf-001"]!,
        territoryId: roy
      },
      "fas-inf-001": {
        ...state.units["fas-inf-001"]!,
        territoryId: fas
      }
    }
  };
}

describe("milestone1Scenario", () => {
  it("starts one faction in Galicia, Catalunya, and Andalucia", () => {
    const state = createInitialGameState();

    expect(milestone1Scenario.factions.map((faction) => faction.id)).toEqual(["com", "roy", "fas"]);
    expect(Object.values(state.units).map((unit) => unit.id)).toEqual([
      "com-inf-001",
      "roy-inf-001",
      "fas-inf-001"
    ]);
    expect(state.control).toEqual({
      galicia: "com",
      catalunya: "roy",
      andalucia: "fas"
    });
    expect(state.units["com-inf-001"]?.territoryId).toBe("galicia");
    expect(state.units["roy-inf-001"]?.territoryId).toBe("catalunya");
    expect(state.units["fas-inf-001"]?.territoryId).toBe("andalucia");
  });
});

describe("validateMoveOrder adjacency", () => {
  it.each<[TerritoryId, TerritoryId]>([
    ["galicia", "asturias"],
    ["galicia", "castilla-y-leon"],
    ["asturias", "cantabria"],
    ["asturias", "castilla-y-leon"],
    ["cantabria", "pais-vasco"],
    ["cantabria", "castilla-y-leon"],
    ["pais-vasco", "navarra"],
    ["pais-vasco", "la-rioja"],
    ["pais-vasco", "castilla-y-leon"],
    ["navarra", "la-rioja"],
    ["navarra", "aragon"],
    ["la-rioja", "aragon"],
    ["la-rioja", "castilla-y-leon"],
    ["aragon", "castilla-y-leon"],
    ["aragon", "castilla-la-mancha"],
    ["aragon", "valencia"],
    ["aragon", "catalunya"],
    ["madrid", "castilla-y-leon"],
    ["madrid", "castilla-la-mancha"],
    ["castilla-y-leon", "extremadura"],
    ["castilla-y-leon", "castilla-la-mancha"],
    ["castilla-la-mancha", "extremadura"],
    ["castilla-la-mancha", "valencia"],
    ["castilla-la-mancha", "murcia"],
    ["castilla-la-mancha", "andalucia"],
    ["extremadura", "andalucia"],
    ["catalunya", "valencia"],
    ["valencia", "murcia"],
    ["murcia", "andalucia"]
  ])("allows neighboring movement from %s to %s", (from, to) => {
    const state = stateWithComAt(from);

    expect(
      validateMoveOrder(
        milestone1Scenario,
        state,
        move("com", "com-inf-001", from, to)
      )
    ).toEqual({ ok: true });
  });

  it.each<[TerritoryId, TerritoryId]>([
    ["galicia", "cantabria"],
    ["galicia", "catalunya"],
    ["asturias", "pais-vasco"],
    ["cantabria", "navarra"],
    ["pais-vasco", "aragon"],
    ["navarra", "castilla-y-leon"],
    ["madrid", "extremadura"],
    ["catalunya", "madrid"],
    ["andalucia", "valencia"],
    ["islas-baleares", "valencia"],
    ["canarias", "andalucia"],
    ["ceuta", "andalucia"],
    ["melilla", "murcia"]
  ])("rejects non-neighbor movement from %s to %s", (from, to) => {
    const state = stateWithComAt(from);

    expect(
      validateMoveOrder(
        milestone1Scenario,
        state,
        move("com", "com-inf-001", from, to)
      )
    ).toEqual({
      ok: false,
      reason: "Destination is not adjacent."
    });
  });

  it("allows every land border in both directions", () => {
    for (const territory of milestone1Scenario.territories) {
      for (const adjacentId of territory.adjacent) {
        const state = stateWithComAt(adjacentId);

        expect(
          validateMoveOrder(
            milestone1Scenario,
            state,
            move("com", "com-inf-001", adjacentId, territory.id)
          )
        ).toEqual({ ok: true });
      }
    }
  });

  it("rejects a move that remains in the same region", () => {
    const state = stateWithComAt("galicia");

    expect(
      validateMoveOrder(
        milestone1Scenario,
        state,
        move("com", "com-inf-001", "galicia", "galicia")
      )
    ).toEqual({
      ok: false,
      reason: "Destination is not adjacent."
    });
  });
});

describe("validateMoveOrder integrity", () => {
  it("rejects wrong faction, unknown unit, wrong origin, and unknown origin", () => {
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

    expect(
      validateMoveOrder(
        milestone1Scenario,
        state,
        move("roy", "com-inf-001", "galicia", "asturias")
      )
    ).toEqual({
      ok: false,
      reason: "Selected unit belongs to another player."
    });
    expect(
      validateMoveOrder(
        milestone1Scenario,
        state,
        move("com", "missing", "galicia", "asturias")
      )
    ).toEqual({
      ok: false,
      reason: "Unknown unit."
    });
    expect(
      validateMoveOrder(
        milestone1Scenario,
        state,
        move("com", "com-inf-001", "asturias", "cantabria")
      )
    ).toEqual({
      ok: false,
      reason: "Selected unit is no longer in that territory."
    });
    expect(
      validateMoveOrder(
        milestone1Scenario,
        stateWithBadOrigin,
        move("com", "com-inf-001", "missing" as TerritoryId, "asturias")
      )
    ).toEqual({
      ok: false,
      reason: "Unknown origin territory."
    });
  });
});

describe("resolveTurn", () => {
  it("moves into an empty neighboring region when uncontested", () => {
    const state = createInitialGameState();
    const result = resolveTurn(milestone1Scenario, state, [
      submit({
        factionId: "com",
        orders: [move("com", "com-inf-001", "galicia", "asturias")]
      })
    ]);

    expect(result.finalUnits["com-inf-001"]?.territoryId).toBe("asturias");
    expect(result.finalControl.asturias).toBe("com");
    expect(result.outcomes[0]?.kind).toBe("successful-move");
  });

  it("keeps an empty contested destination empty", () => {
    const state = stateWithPositions("galicia", "cantabria", "andalucia");
    const result = resolveTurn(milestone1Scenario, state, [
      submit({
        factionId: "com",
        orders: [move("com", "com-inf-001", "galicia", "asturias")]
      }),
      submit({
        factionId: "roy",
        orders: [move("roy", "roy-inf-001", "cantabria", "asturias")]
      })
    ]);

    expect(result.finalUnits["com-inf-001"]?.territoryId).toBe("galicia");
    expect(result.finalUnits["roy-inf-001"]?.territoryId).toBe("cantabria");
    expect(result.finalControl.asturias).toBeUndefined();
  });

  it("disbands a defender that fails to vacate while the attacker succeeds", () => {
    const state = stateWithPositions("galicia", "asturias", "cantabria");
    const result = resolveTurn(milestone1Scenario, state, [
      submit({
        factionId: "com",
        orders: [move("com", "com-inf-001", "galicia", "asturias")]
      }),
      submit({
        factionId: "roy",
        orders: [move("roy", "roy-inf-001", "asturias", "cantabria")]
      }),
      submit({ factionId: "fas", orders: [] })
    ]);

    expect(result.finalUnits["com-inf-001"]?.territoryId).toBe("asturias");
    expect(result.finalUnits["roy-inf-001"]).toBeUndefined();
    expect(result.finalControl.asturias).toBe("com");
    expect(result.summaryLines.join(" ")).toContain("disbanded roy-inf-001");
  });

  it("disbands a bounced attacker whose origin was captured", () => {
    const state = stateWithPositions("galicia", "castilla-y-leon", "cantabria");
    const result = resolveTurn(milestone1Scenario, state, [
      submit({
        factionId: "com",
        orders: [move("com", "com-inf-001", "galicia", "asturias")]
      }),
      submit({
        factionId: "roy",
        orders: [move("roy", "roy-inf-001", "castilla-y-leon", "galicia")]
      }),
      submit({
        factionId: "fas",
        orders: [move("fas", "fas-inf-001", "cantabria", "asturias")]
      })
    ]);

    expect(result.finalUnits["com-inf-001"]).toBeUndefined();
    expect(result.finalUnits["roy-inf-001"]?.territoryId).toBe("galicia");
    expect(result.finalUnits["fas-inf-001"]?.territoryId).toBe("cantabria");
    expect(result.finalControl.galicia).toBe("roy");
  });

  it("bounces units attempting a head-on swap", () => {
    const state = stateWithPositions("galicia", "asturias", "andalucia");
    const result = resolveTurn(milestone1Scenario, state, [
      submit({
        factionId: "com",
        orders: [move("com", "com-inf-001", "galicia", "asturias")]
      }),
      submit({
        factionId: "roy",
        orders: [move("roy", "roy-inf-001", "asturias", "galicia")]
      })
    ]);

    expect(result.finalUnits["com-inf-001"]?.territoryId).toBe("galicia");
    expect(result.finalUnits["roy-inf-001"]?.territoryId).toBe("asturias");
    expect(result.summaryLines.join(" ")).toContain("Units attempted to swap territories.");
  });

  it("allows three-unit cycles across mutually neighboring regions", () => {
    const state = stateWithPositions("galicia", "asturias", "castilla-y-leon");
    const result = resolveTurn(milestone1Scenario, state, [
      submit({
        factionId: "com",
        orders: [move("com", "com-inf-001", "galicia", "asturias")]
      }),
      submit({
        factionId: "roy",
        orders: [move("roy", "roy-inf-001", "asturias", "castilla-y-leon")]
      }),
      submit({
        factionId: "fas",
        orders: [move("fas", "fas-inf-001", "castilla-y-leon", "galicia")]
      })
    ]);

    expect(result.finalUnits["com-inf-001"]?.territoryId).toBe("asturias");
    expect(result.finalUnits["roy-inf-001"]?.territoryId).toBe("castilla-y-leon");
    expect(result.finalUnits["fas-inf-001"]?.territoryId).toBe("galicia");
  });

  it("disbands units with impossible submitted orders", () => {
    const state = createInitialGameState();
    const result = resolveTurn(milestone1Scenario, state, [
      submit({
        factionId: "com",
        orders: [move("com", "com-inf-001", "galicia", "catalunya")]
      })
    ]);

    expect(result.finalUnits["com-inf-001"]).toBeUndefined();
    expect(result.outcomes[0]?.kind).toBe("invalid-order");
  });

  it("handles missing submissions as no move", () => {
    const state = createInitialGameState();
    const result = resolveTurn(milestone1Scenario, state, []);

    expect(result.outcomes.map((outcome) => outcome.kind)).toEqual([
      "no-move",
      "no-move",
      "no-move"
    ]);
    expect(result.finalUnits["com-inf-001"]?.territoryId).toBe("galicia");
  });
});
