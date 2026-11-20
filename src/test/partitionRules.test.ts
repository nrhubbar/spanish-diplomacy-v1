import { describe, expect, it } from "vitest";
import { holdersIn, isContested } from "../main/engine/partition/holders";
import { contestedReasons, validateWithdrawOrder } from "../main/engine/partition/orders";
import { withdrawRoutes } from "../main/engine/partition/paths";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import { retreatDestination, settleDepartures } from "../main/engine/retreat";
import type { BattleOutcome, GameState, Scenario, SubTerritoryId, TurnResolutionResult, WithdrawOrder } from "../main/engine/types";
import { validateMoveOrder } from "../main/engine/validation";
import { isSeaRouteClosed } from "../main/engine/weather";
import { faction, move, spainD20, territory, unit, withUnits } from "./support";

/**
 * Make-it-right regressions for the map and movement review: B1 (a partial grade that takes a
 * defender's last sub-territory), B2 (D27.1, only units that can fight take ground), B3 (Withdraw
 * and retreats across a closed sea, and the lane's ports).
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

/** Spain in late December with Rain in every zone: the Mediterranean and the Strait are closed (T4). */
function storm(state: GameState, scenario: Scenario): GameState {
  const outcomes = Object.fromEntries((scenario.weather?.zones ?? []).map((zone) => [zone.id, "rain"]));
  return { ...state, turnNumber: 11, weather: { outcomes: outcomes as NonNullable<GameState["weather"]>["outcomes"], roll: 15 } };
}

function holders(state: GameState, changes: Readonly<Record<string, string>>): GameState {
  const subTerritories = { ...state.subTerritories };
  for (const [id, holder] of Object.entries(changes)) {
    const before = subTerritories[sub(id)];
    if (before === undefined) throw new Error(id);
    subTerritories[sub(id)] = { ...before, holder: faction(holder) };
  }
  return { ...state, subTerritories };
}

describe("Withdraw and retreats across the sea (B3, T4, M5, P6)", () => {
  const scenario = spainD20();
  const withdrawal = (from: string, to: string): WithdrawOrder => ({ factionId: faction("republic"), from: territory(from), kind: "withdraw", to: territory(to), unitId: unit("rep-castilla-3") });
  // The Republic holds Mallorca (the lane's port) and Menorca; the South holds Ibiza, so the islands are contested.
  const islands = holders(withUnits(scenario, [["rep-castilla-3", "republic", "islas-baleares"], ["rep-durruti-column", "republic", "catalunya"]]), { mallorca: "republic", menorca: "republic" });

  it("withdraws over an open sea from the lane's port", () => {
    expect(isSeaRouteClosed(scenario, islands, territory("islas-baleares"), territory("catalunya"))).toBe(false);
    expect(validateWithdrawOrder(scenario, islands, withdrawal("islas-baleares", "catalunya"))).toEqual({ ok: true });
    expect(withdrawRoutes(scenario, islands, faction("republic"), territory("islas-baleares")).map((route) => route.to)).toEqual(["catalunya", "valencia"]);
  });

  it("refuses a Withdraw and a retreat over a sea the storms closed", () => {
    const closed = storm(islands, scenario);
    expect(isSeaRouteClosed(scenario, closed, territory("islas-baleares"), territory("catalunya"))).toBe(true);
    expect(validateWithdrawOrder(scenario, closed, withdrawal("islas-baleares", "catalunya"))).toEqual({ ok: false, reason: contestedReasons.withdrawSeaClosed });
    expect(withdrawRoutes(scenario, closed, faction("republic"), territory("islas-baleares"))).toEqual([]);
    expect(retreatDestination(scenario, closed, Object.values(closed.units), faction("republic"), territory("islas-baleares"))).toBeUndefined();
    const settled = settleDepartures(scenario, closed, closed.units, [{ from: territory("islas-baleares"), kind: "retreat", report: { battleIndex: 0 }, unitId: unit("rep-castilla-3") }]);
    expect(settled.settled[0]?.kind).toBe("surrendered");
  });

  it("keeps the South in Andalucia from retreating across a closed Strait to Ceuta", () => {
    const state = withUnits(scenario, [["south-granada-6", "south", "andalucia"]]);
    expect(retreatDestination(scenario, state, Object.values(state.units), faction("south"), territory("andalucia"))).toBe("ceuta");
    expect(retreatDestination(scenario, storm(state, scenario), Object.values(state.units), faction("south"), territory("andalucia"))).toBeUndefined();
  });

  it("needs the lane's port: Menorca alone has no way off the islands (Q-CITY-7)", () => {
    const menorca = withUnits(scenario, [["rep-castilla-3", "republic", "islas-baleares"]]);
    expect(menorca.subTerritories[sub("mallorca")]?.holder).toBe("south");
    expect(withdrawRoutes(scenario, menorca, faction("republic"), territory("islas-baleares"))).toEqual([]);
    // Without a port in the sub-territory it sails from, a sea crossing is no path either.
    const noPort = { ...islands, subTerritories: { ...islands.subTerritories, [sub("mallorca")]: { ...islands.subTerritories[sub("mallorca")]!, port: 0 } } } as GameState;
    expect(validateWithdrawOrder(scenario, noPort, withdrawal("islas-baleares", "catalunya"))).toEqual({ ok: false, reason: contestedReasons.withdrawNoPath });
  });
});

describe("Withdraw refusals (M-7, C1, P6)", () => {
  const scenario = spainD20();
  const start = initialGameState(scenario);
  const order = (factionId: string, unitId: string, from: string, to: string): WithdrawOrder => ({ factionId: faction(factionId), from: territory(from), kind: "withdraw", to: territory(to), unitId: unit(unitId) });

  it.each([
    ["an unknown unit", order("republic", "nobody", "andalucia", "murcia"), "Unknown unit."],
    ["another faction's unit", order("republic", "south-granada-6", "andalucia", "murcia"), "Selected unit belongs to another player."],
    ["a unit that is elsewhere", order("republic", "rep-vitoria-8", "extremadura", "castilla-la-mancha"), "Selected unit is no longer in that territory."],
    ["an aircraft", order("south", "south-ju52-bombers", "andalucia", "ceuta"), "This unit cannot withdraw."],
    ["ground that is not contested", order("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha"), contestedReasons.withdrawNotContested],
    ["a territory that is not next door", order("republic", "rep-vitoria-8", "andalucia", "catalunya"), contestedReasons.withdrawTarget],
    ["a neighbour not held whole", order("republic", "rep-vitoria-8", "andalucia", "extremadura"), contestedReasons.withdrawTarget],
    ["a pocket with no way out", order("north", "north-milan-32", "asturias", "galicia"), contestedReasons.withdrawNoPath]
  ] as const)("refuses %s", (_name, withdrawal, reason) => {
    expect(validateWithdrawOrder(scenario, start, withdrawal)).toEqual({ ok: false, reason });
  });

  it("is not an order at all without the provinces module, which then leaves moves, retreats and works alone", async () => {
    const { partitionCanDigIn, partitionOrderVerdict, partitionRetreatAllowed, partitionValidateWithdraw } = await import("../main/engine/partition/orders");
    const { unavailableOrderReason } = await import("../main/engine/hooks");
    const { spainM2 } = await import("./support");
    const plain = spainM2();
    const state = initialGameState(plain);
    const withdrawal = order("republic", "rep-vitoria-8", "andalucia", "murcia");
    expect(partitionValidateWithdraw({ order: withdrawal, scenario: plain, state })).toEqual({ ok: false, reason: unavailableOrderReason });
    expect(partitionOrderVerdict({ order: move("republic", "rep-vitoria-8", "andalucia", "murcia"), scenario: plain, state })).toBeUndefined();
    expect(partitionRetreatAllowed({ factionId: faction("republic"), from: territory("andalucia"), scenario: plain, state, to: territory("murcia") })).toBe(true);
    expect(partitionCanDigIn(plain, state, territory("andalucia"))).toBe(true);
    expect(partitionOrderVerdict({ order: withdrawal, scenario, state: start })).toBeUndefined();
  });

  it("falls back on territory control where a territory has no sub-territories", async () => {
    const { holdsWhole } = await import("../main/engine/partition/holders");
    const { hasPath } = await import("../main/engine/partition/paths");
    const { tiny } = await import("./support");
    const small = tiny();
    const state = initialGameState(small);
    const [first] = small.territories;
    if (first === undefined) throw new Error("territory");
    const control = state.control[first.id];
    const contested: GameState = { ...state, control: { ...state.control, [first.id]: { factionIds: [faction("red"), faction("blue")], kind: "contested" } } };
    expect(isContested(small, contested, first.id)).toBe(true);
    expect(isContested(small, state, first.id)).toBe(false);
    expect(holdsWhole(small, state, first.id, control?.kind === "controlled" ? control.factionId : faction("red"))).toBe(control?.kind === "controlled");
    expect(holdsWhole(small, contested, first.id, faction("red"))).toBe(false);
    expect(hasPath(small, state, faction("red"), first.id, first.id)).toBe(true);
  });
});
