import { describe, expect, it } from "vitest";
import { initialGameState, resolveTurn } from "../../main/engine/resolution";
import type { AirMissionOrder, GameState, Scenario, TurnOutcome, UnitState } from "../../main/engine/types";
import { faction, move, spainD20, territory, unit } from "../support";

/** Air and generals under Spain as shipped, on the d20 (D17, DC-5, DC-16). */

const seed = 5;
const battleOf = (outcomes: readonly TurnOutcome[]) => outcomes.find((outcome): outcome is Extract<TurnOutcome, { kind: "battle" }> => outcome.kind === "battle");

function withUnitAt(state: GameState, id: string, changes: Partial<UnitState>): GameState {
  const current = state.units[unit(id)];
  if (current === undefined) throw new Error(`no unit ${id}`);
  return { ...state, units: { ...state.units, [id]: { ...current, ...changes } } };
}

function without(state: GameState, ...ids: readonly string[]): GameState {
  return { ...state, units: Object.fromEntries(Object.entries(state.units).filter(([id]) => !ids.includes(id))) };
}

describe("air and generals on the d20", () => {
  const scenario = spainD20();
  const state = initialGameState(scenario);
  const attack = ["north-san-marcial-22", "north-san-quintin-25", "north-la-victoria-28"].map((id) => move("north", id, "castilla-y-leon", "madrid"));

  it("keeps aircraft off both battle sides, and lets the d20 give the defending general his +1 once", () => {
    const battle = battleOf(resolveTurn(scenario, state, [{ factionId: faction("north"), orders: attack }], seed).outcomes);
    if (battle === undefined) throw new Error("expected a battle");
    const defenders = battle.defender.armies.map((army) => army.unitId);
    expect(defenders).not.toContain("rep-breguet-bombers");
    expect(defenders).not.toContain("rep-ni52-fighters");
    expect(battle.defender.armies.find((army) => army.unitId === "rep-general-miaja")?.value).toBe(0);
    expect(battle.modifiers.filter((modifier) => modifier.kind === "general")).toEqual([{ factionId: "republic", generalId: "jose-miaja", kind: "general", role: "defence", roll: -1 }]);
  });

  it("adds bomber support to the d20 battle through the hook", () => {
    const support: AirMissionOrder = { factionId: faction("south"), kind: "air-mission", mission: { kind: "support", territoryId: territory("madrid") }, unitId: unit("south-ju52-bombers") };
    const result = resolveTurn(scenario, state, [{ factionId: faction("north"), orders: attack }, { factionId: faction("south"), orders: [support] }], seed);
    // The South flies over the North's attack: not its battle, so no bonus for either side.
    expect(battleOf(result.outcomes)?.modifiers.some((modifier) => modifier.kind === "air-support")).toBe(false);
    const own: AirMissionOrder = { ...support, factionId: faction("republic"), unitId: unit("rep-breguet-bombers") };
    const defended = resolveTurn(scenario, state, [{ factionId: faction("north"), orders: attack }, { factionId: faction("republic"), orders: [own] }], seed);
    expect(battleOf(defended.outcomes)?.modifiers).toContainEqual({ factionId: "republic", kind: "air-support", role: "defence", roll: -2, unitIds: ["rep-breguet-bombers"] });
  });

  it("rolls for a general left alone in ground the enemy took", () => {
    const deadly: Scenario = { ...scenario, air: { ...scenario.air!, generalDeathRoll: 20 } };
    const alone = withUnitAt(without(state, "south-legion", "south-regulares-west", "south-granada-6", "south-lepanto-5", "south-cadiz-33", "south-africa-vanguard"), "rep-vitoria-8", { territoryId: territory("andalucia") });
    const exposed: GameState = { ...alone, control: { ...alone.control, [territory("andalucia")]: { factionId: faction("republic"), kind: "controlled" } } };
    const result = resolveTurn(deadly, exposed, [{ factionId: faction("republic"), orders: [move("republic", "rep-vitoria-8", "andalucia", "ceuta")] }], seed);
    expect(result.outcomes).toContainEqual(expect.objectContaining({ generalId: "juan-yague", kind: "general-died" }));
    expect(result.outcomes).toContainEqual({ arrivesOnTurn: 2, factionId: "south", generalId: "jose-varela", kind: "replacement-due" });
    expect(result.finalState.units[unit("south-general-yague")]).toBeUndefined();
  });
});
