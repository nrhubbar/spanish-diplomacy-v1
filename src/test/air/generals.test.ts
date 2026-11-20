import { describe, expect, it } from "vitest";
import { holdWhole } from "./holdWhole";
import { generalModifiers } from "../../main/engine/generals/command";
import { generalUnitDefinition } from "../../main/engine/generals/identity";
import { nextOnRoster } from "../../main/engine/generals/roster";
import { estimateAttack } from "../../main/engine/combat";
import { requireUnitDefinition } from "../../main/engine/lookup";
import { initialGameState, resolveTurn } from "../../main/engine/resolution";
import type { GameState, GeneralId, Scenario, SackOrder, TurnOutcome, UnitId, UnitState } from "../../main/engine/types";
import { faction, move, spainWithAir, territory, tiny, unit } from "../support";

const seed = 3;
const sack = (factionId: string, unitId: string): SackOrder => ({ factionId: faction(factionId), kind: "sack", unitId: unit(unitId) });
const kinds = (outcomes: readonly TurnOutcome[]): readonly string[] => outcomes.map((outcome) => outcome.kind);

function withUnitAt(state: GameState, id: string, changes: Partial<UnitState>): GameState {
  const current = state.units[unit(id)];
  if (current === undefined) throw new Error(`no unit ${id}`);
  return { ...state, units: { ...state.units, [id]: { ...current, ...changes } } };
}

function without(state: GameState, ...ids: readonly string[]): GameState {
  return { ...state, units: Object.fromEntries(Object.entries(state.units).filter(([id]) => !ids.includes(id))) };
}

describe("a general's command bonus and trait (D4, U5, U6)", () => {
  const scenario = spainWithAir();
  const state = initialGameState(scenario);

  it("gives the defender's best general his +1 and his trait", () => {
    const modifiers = generalModifiers({ attackerFactionId: faction("north"), defenderFactionIds: [faction("republic")], diggingIn: true, scenario, state, territoryId: territory("madrid") });
    expect(modifiers).toEqual([
      { factionId: "republic", generalId: "jose-miaja", kind: "general", role: "defence", roll: -1 },
      { generalId: "jose-miaja", kind: "trait", role: "defence", roll: -1, traitId: "tenacious" }
    ]);
  });

  it("gives an attacking general his +1 and his trait when he moves with the attack", () => {
    const attack = estimateAttack(scenario, state, faction("north"), [unit("north-navarre-requetes"), unit("north-general-mola")], territory("aragon"));
    expect(attack.kind === "battle" ? attack.modifiers.filter((modifier) => modifier.kind === "general" || modifier.kind === "trait") : []).toEqual([]);
    const intoMadrid = estimateAttack(scenario, withUnitAt(state, "north-general-mola", { territoryId: territory("castilla-y-leon") }), faction("north"),
      [unit("north-san-marcial-22"), unit("north-general-mola")], territory("madrid"));
    if (intoMadrid.kind !== "battle") throw new Error("expected a battle");
    expect(intoMadrid.modifiers).toContainEqual({ factionId: "north", generalId: "emilio-mola", kind: "general", role: "attack", roll: 1 });
    expect(intoMadrid.modifiers).toContainEqual({ generalId: "emilio-mola", kind: "trait", role: "attack", roll: 1, traitId: "aggressive" });
    // A general never adds to the side's value: only ground units fight.
    expect(intoMadrid.attacker.armies.map((army) => army.unitId)).toEqual(["north-san-marcial-22"]);
  });

  it("counts only the best single general on a side (declog D5)", () => {
    const rojo = generalUnitDefinition(scenario, "general-vicente-rojo" as UnitId);
    if (rojo === undefined) throw new Error("no Rojo");
    const twoGenerals: GameState = {
      ...state,
      raised: { ...state.raised, [rojo.id]: rojo },
      units: { ...state.units, [rojo.id]: { factionId: faction("republic"), fatigue: 0, id: rojo.id, morale: { demoralized: false, quietTurns: 0 }, strength: 100, territoryId: territory("madrid") } }
    };
    const modifiers = generalModifiers({ attackerFactionId: faction("north"), defenderFactionIds: [faction("republic")], diggingIn: true, scenario, state: twoGenerals, territoryId: territory("madrid") });
    expect(modifiers.filter((modifier) => modifier.kind === "general")).toHaveLength(1);
    expect(modifiers[0]).toMatchObject({ generalId: "jose-miaja" });
  });

  it("applies the general's +1 in the turn's battles through the combatModifiers hook", () => {
    const attack = ["north-san-marcial-22", "north-san-quintin-25", "north-la-victoria-28"].map((id) => move("north", id, "castilla-y-leon", "madrid"));
    const result = resolveTurn(scenario, state, [{ factionId: faction("north"), orders: attack }], seed);
    const battle = result.outcomes.find((outcome) => outcome.kind === "battle");
    expect(battle?.modifiers.filter((modifier) => modifier.kind === "general")).toEqual([{ factionId: "republic", generalId: "jose-miaja", kind: "general", role: "defence", roll: -1 }]);
  });
});

describe("sacking and replacements (U5, D7)", () => {
  const scenario = spainWithAir();
  const state = initialGameState(scenario);

  it("sacks for free and calls the next general on the roster, who arrives the next turn in the seat", () => {
    const first = resolveTurn(scenario, state, [{ factionId: faction("republic"), orders: [sack("republic", "rep-general-miaja")] }], seed);
    expect(first.outcomes).toContainEqual({ generalId: "jose-miaja", kind: "general-sacked", order: sack("republic", "rep-general-miaja") });
    expect(first.outcomes).toContainEqual({ arrivesOnTurn: 2, factionId: "republic", generalId: "vicente-rojo", kind: "replacement-due" });
    expect(first.finalState.units[unit("rep-general-miaja")]).toBeUndefined();
    expect(first.finalState.generals[faction("republic")]).toEqual({ nextIndex: 2, pending: [{ arrivesOnTurn: 2, factionId: "republic", generalId: "vicente-rojo" }] });

    const second = resolveTurn(scenario, { ...first.finalState, turnNumber: 2 }, [], seed);
    expect(second.outcomes).toContainEqual({ factionId: "republic", generalId: "vicente-rojo", kind: "replacement-arrived", territoryId: "madrid", unitId: "general-vicente-rojo" });
    expect(second.finalState.units[unit("general-vicente-rojo")]?.territoryId).toBe("madrid");
    expect(second.finalState.generals[faction("republic")]?.pending).toEqual([]);
    expect(requireUnitDefinition(scenario, unit("general-vicente-rojo")).name).toBe("Vicente Rojo");
  });

  it("skips generals in play or on their way, and stops when the roster runs out", () => {
    expect(nextOnRoster(scenario, state.generals, faction("north"), new Set(["emilio-mola" as GeneralId]))?.general.id).toBe("fidel-davila");
    const spent = { ...state.generals, [faction("north")]: { nextIndex: 3, pending: [] } };
    expect(nextOnRoster(scenario, spent, faction("north"), new Set())).toBeUndefined();
  });

  it("rejects a Sack order for a unit that is not a general", () => {
    const result = resolveTurn(scenario, state, [{ factionId: faction("republic"), orders: [sack("republic", "rep-wad-ras-1")] }], seed);
    expect(result.outcomes).toContainEqual(expect.objectContaining({ kind: "rejected-order", reason: "Only a general can be sacked." }));
  });
});

describe("rallies and deaths (C5, U5, D7)", () => {
  const scenario = spainWithAir();
  const state = initialGameState(scenario);

  it("rallies the demoralized units of the army he moves with", () => {
    const shaken = withUnitAt(state, "north-navarre-requetes", { morale: { demoralized: true, quietTurns: 0 } });
    const orders = [move("north", "north-navarre-requetes", "navarra", "la-rioja"), move("north", "north-general-mola", "navarra", "la-rioja")];
    const result = resolveTurn(scenario, shaken, [{ factionId: faction("north"), orders }], seed);
    expect(result.outcomes).toContainEqual({ factionId: "north", generalId: "emilio-mola", kind: "rallied", territoryId: "la-rioja", unitIds: ["north-navarre-requetes"] });
    expect(result.finalState.units[unit("north-navarre-requetes")]?.morale.demoralized).toBe(false);
    expect(result.finalState.units[unit("north-general-mola")]?.territoryId).toBe("la-rioja");
    expect(kinds(result.outcomes)).toContain("general-moved");
  });

  it("does not rally under an uninspiring general", () => {
    const asensio = generalUnitDefinition(scenario, "general-jose-asensio" as UnitId);
    if (asensio === undefined) throw new Error("no Asensio");
    const shaken = withUnitAt(without(state, "rep-general-miaja"), "rep-wad-ras-1", { morale: { demoralized: true, quietTurns: 0 } });
    const led: GameState = {
      ...shaken,
      raised: { [asensio.id]: asensio },
      units: { ...shaken.units, [asensio.id]: { factionId: faction("republic"), fatigue: 0, id: asensio.id, morale: { demoralized: false, quietTurns: 0 }, strength: 100, territoryId: territory("madrid") } }
    };
    const result = resolveTurn(scenario, led, [{ factionId: faction("republic"), orders: [move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha"), move("republic", asensio.id, "madrid", "castilla-la-mancha")] }], seed);
    expect(kinds(result.outcomes)).not.toContain("rallied");
  });

  it("rolls for the general's life when his army is destroyed, and calls a replacement when he dies", () => {
    const deadly: Scenario = { ...scenario, air: { ...scenario.air!, generalDeathRoll: 20 } };
    // Yague stands alone in Ceuta, and the Republic lands there.
    const alone = withUnitAt(without(state, "south-legion", "south-regulares-west"), "rep-vitoria-8", { territoryId: territory("andalucia") });
    const exposed = holdWhole(scenario, alone, territory("andalucia"), faction("republic"));
    const result = resolveTurn(deadly, without(exposed, "south-granada-6", "south-lepanto-5", "south-cadiz-33", "south-africa-vanguard"),
      [{ factionId: faction("republic"), orders: [move("republic", "rep-vitoria-8", "andalucia", "ceuta")] }], seed);
    expect(result.outcomes).toContainEqual({ factionId: "south", generalId: "juan-yague", kind: "general-died", territoryId: "ceuta", unitId: "south-general-yague" });
    expect(result.outcomes).toContainEqual({ arrivesOnTurn: 2, factionId: "south", generalId: "jose-varela", kind: "replacement-due" });

    const lucky: Scenario = { ...scenario, air: { ...scenario.air!, generalDeathRoll: 0 } };
    const survived = resolveTurn(lucky, without(exposed, "south-granada-6", "south-lepanto-5", "south-cadiz-33", "south-africa-vanguard"),
      [{ factionId: faction("republic"), orders: [move("republic", "rep-vitoria-8", "andalucia", "ceuta")] }], seed);
    expect(kinds(survived.outcomes)).not.toContain("general-died");
    expect(survived.finalState.units[unit("south-general-yague")]?.territoryId).not.toBe("ceuta");
  });
});

describe("the d6 preset (CT-21)", () => {
  it("has no generals and no air, so Milestone 2 play is unchanged", () => {
    const scenario = tiny();
    expect(scenario.generals).toEqual([]);
    expect(scenario.rules.air).toBe("none");
    expect(Object.keys(initialGameState(scenario).generals)).toEqual([]);
  });
});
