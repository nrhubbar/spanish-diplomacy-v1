import { describe, expect, it } from "vitest";
import { holdersIn, isContested } from "../main/engine/partition/holders";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type { BattleOutcome, GameState, Scenario, SubTerritoryId, TurnResolutionResult } from "../main/engine/types";
import { validateMoveOrder } from "../main/engine/validation";
import { faction, move, spainD20, territory, unit, withUnits } from "./support";

/**
 * Make-it-right regressions for the map and movement review: B1 (a partial grade that takes a
 * defender's last sub-territory), B2 (D27.1, only units that can fight take ground).
 */

const sub = (id: string): SubTerritoryId => id as SubTerritoryId;

/** The first constant die in a sweep of 0..1 whose battle in the territory takes partial ground. */
function partialBattle(scenario: Scenario, state: GameState, submissions: Parameters<typeof resolveTurn>[2], territoryId: string): { readonly battle: BattleOutcome; readonly result: TurnResolutionResult } {
  for (let value = 0; value < 1; value += 0.025) {
    const result = resolveTurn(scenario, state, submissions, 1, () => () => value);
    const battle = result.outcomes.find((outcome): outcome is BattleOutcome => outcome.kind === "battle" && "territoryId" in outcome.site && outcome.site.territoryId === territoryId);
    const ground = battle === undefined ? undefined : (battle as { readonly ground?: unknown }).ground;
    if (battle !== undefined && (ground === 1 || ground === 2)) return { battle, result };
  }
  throw new Error(`no partial-ground battle in ${territoryId}`);
}

describe("a partial grade that takes the defender's last ground (B1, P5, Q-PART-6)", () => {
  it("makes the defender retreat from a standing battle (step 7)", () => {
    const scenario = spainD20();
    const state = initialGameState(scenario);
    const { battle, result } = partialBattle(scenario, state, [], "asturias");
    expect(battle.site.kind).toBe("standing");
    // The Republic's only sub-territory in Asturias fell, so its militia had to go (M21 with P6).
    expect(holdersIn(scenario, result.finalState.subTerritories, territory("asturias"))).toEqual(["north"]);
    const militia = result.finalState.units[unit("rep-asturian-militia")];
    expect(militia?.territoryId).not.toBe("asturias");
    expect(battle.retreats.map((entry) => entry.unitId)).toContain("rep-asturian-militia");
    if (militia !== undefined) {
      expect(militia.territoryId).toBe("cantabria");
    }
    expect(isContested(scenario, result.finalState, territory("asturias"))).toBe(false);
  });

  it("makes the defender retreat from an assault (step 5)", () => {
    const scenario = spainD20();
    const state = withUnits(scenario, [
      ["north-san-marcial-22", "north", "castilla-y-leon"], ["north-san-quintin-25", "north", "castilla-y-leon"], ["north-la-victoria-28", "north", "castilla-y-leon"],
      ["rep-castilla-3", "republic", "extremadura"]
    ]);
    const orders = ["north-san-marcial-22", "north-san-quintin-25", "north-la-victoria-28"].map((id) => move("north", id, "castilla-y-leon", "extremadura"));
    const { battle, result } = partialBattle(scenario, state, [{ factionId: faction("north"), orders }], "extremadura");
    expect(battle.site.kind).toBe("assault");
    expect(result.finalState.subTerritories[sub("badajoz")]?.holder).toBe("north");
    const defender = result.finalState.units[unit("rep-castilla-3")];
    expect(defender?.territoryId).not.toBe("extremadura");
    expect(battle.retreats.map((entry) => entry.unitId).concat(battle.surrenderedUnitIds)).toContain("rep-castilla-3");
  });
});

describe("only units that can fight take ground (B2, D27.1)", () => {
  it("holds back a lone general advancing into enemy ground, and does not let him take it", () => {
    const scenario = spainD20();
    const base = withUnits(scenario, [["north-general-mola", "north", "castilla-y-leon"], ["north-sierra-column", "north", "castilla-y-leon"]]);
    const order = move("north", "north-general-mola", "castilla-y-leon", "castilla-la-mancha");
    // Each order validates on its own (M9); the army is checked as an army at step 1.
    expect(validateMoveOrder(scenario, base, order)).toEqual({ ok: true });
    const result = resolveTurn(scenario, base, [{ factionId: faction("north"), orders: [order] }], 1);
    expect(result.outcomes).toContainEqual(expect.objectContaining({ kind: "move-held-back", reason: "cannot-fight", unitIds: ["north-general-mola"] }));
    expect(result.finalState.units[unit("north-general-mola")]?.territoryId).toBe("castilla-y-leon");
    expect(result.finalState.control[territory("castilla-la-mancha")]).toEqual({ factionId: "republic", kind: "controlled" });
  });

  it("lets a general advance with his army, which takes the ground", () => {
    const scenario = spainD20();
    const state = withUnits(scenario, [["north-general-mola", "north", "castilla-y-leon"], ["north-sierra-column", "north", "castilla-y-leon"]]);
    const orders = ["north-general-mola", "north-sierra-column"].map((id) => move("north", id, "castilla-y-leon", "castilla-la-mancha"));
    const result = resolveTurn(scenario, state, [{ factionId: faction("north"), orders }], 1);
    expect(result.finalState.control[territory("castilla-la-mancha")]).toEqual({ factionId: "north", kind: "controlled" });
  });

  it("does not let a lone general in contested ground sweep it", () => {
    const scenario = spainD20();
    // A general already in contested Extremadura, with no fighting unit of his side there.
    const state = withUnits(scenario, [["south-general-yague", "south", "extremadura"]]);
    const result = resolveTurn(scenario, state, [], 1);
    expect(result.subTerritoryChanges.filter((change) => change.cause === "sweep" || change.cause === "occupation")).toEqual([]);
    expect(holdersIn(scenario, result.finalState.subTerritories, territory("extremadura"))).toEqual(["republic", "north"]);
  });

  it("lets a lone general reinforce his own side", () => {
    const scenario = spainD20();
    const state = withUnits(scenario, [["south-general-yague", "south", "ceuta"], ["south-granada-6", "south", "andalucia"]]);
    const order = { ...move("south", "south-general-yague", "ceuta", "andalucia"), legs: [{ kind: "sea" as const, to: territory("andalucia") }] };
    const result = resolveTurn(scenario, state, [{ factionId: faction("south"), orders: [order] }], 1);
    expect(result.outcomes.some((outcome) => outcome.kind === "move-held-back")).toBe(false);
    expect(result.finalState.units[unit("south-general-yague")]?.territoryId).toBe("andalucia");
  });
});
