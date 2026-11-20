import { describe, expect, it } from "vitest";
import { holdWhole } from "./air/holdWhole";
import { movePlanningView } from "../main/ai/computerPlayer";
import { raidIncomeDelta } from "../main/engine/air/hooks";
import { estimateAttack } from "../main/engine/combat";
import { applyGradeSide } from "../main/engine/d20/grades";
import { gradedSide } from "../main/engine/d20/modifiers";
import type { BattleDice } from "../main/engine/dice";
import { bestGeneral } from "../main/engine/generals/command";
import { generalUnitDefinition } from "../main/engine/generals/identity";
import { classifyMoves } from "../main/engine/orders";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type {
  AirMission,
  AirMissionOrder,
  D20BattleOutcome,
  GameState,
  MoveOrder,
  PlayerSubmission,
  Scenario,
  SubTerritoryId,
  TurnOutcome,
  TurnResolutionResult,
  UnitId,
  UnitState
} from "../main/engine/types";
import { canFight } from "../main/engine/units/fighting";
import { type ArmySpec, battlefield, faction, move, onD6Dice, spainD20, territory, unit } from "./support";

/**
 * Regression tests for the combat and air review (B1-B4, M1, M2, M5-M9) and the integrator's
 * defaults D27.1-D27.7, on Spain as shipped (the d20, aircraft and generals).
 */

const scenario = spainD20();
const opening = initialGameState(scenario);

/** Loaded d20s: battle `i` rolls `faces[i]` (else 10); later draws (tie-breaks) return 0. */
function loadedD20(faces: readonly number[]): BattleDice {
  return (index) => {
    let draws = 0;
    return () => {
      draws += 1;
      return draws === 1 ? ((faces[index] ?? 10) - 0.5) / 20 : 0;
    };
  };
}

function submit(...orders: readonly (MoveOrder | AirMissionOrder)[]): readonly PlayerSubmission[] {
  const factions = [...new Set(orders.map((order) => order.factionId))];
  return factions.map((factionId) => ({ factionId, orders: orders.filter((order) => order.factionId === factionId) }));
}

function mission(factionId: string, unitId: string, flown: AirMission): AirMissionOrder {
  return { factionId: faction(factionId), kind: "air-mission", mission: flown, unitId: unit(unitId) };
}

const battles = (result: TurnResolutionResult): readonly D20BattleOutcome[] =>
  result.outcomes.flatMap((outcome) => (outcome.kind === "battle" && outcome.dice === "d20" ? [outcome] : []));

const ofKind = <Kind extends TurnOutcome["kind"]>(result: TurnResolutionResult, kind: Kind) =>
  result.outcomes.filter((outcome): outcome is Extract<TurnOutcome, { kind: Kind }> => outcome.kind === kind);

/** Spain's board with exactly these armies, plus Spain's own pieces (generals, aircraft) by id, moved where given. */
function board(armies: readonly ArmySpec[], pieces: Readonly<Record<string, string>> = {}): { readonly scenario: Scenario; readonly state: GameState } {
  const field = battlefield(scenario, armies);
  const units: Record<UnitId, UnitState> = { ...field.state.units };
  for (const [id, territoryId] of Object.entries(pieces)) {
    const piece = opening.units[unit(id)];
    if (piece === undefined) throw new Error(`no piece ${id}`);
    units[unit(id)] = { ...piece, territoryId: territory(territoryId) };
  }
  return { scenario: field.scenario, state: { ...field.state, units } };
}

/** A replacement general (D7) standing in a territory, resolved from his id alone. */
function withGeneral(state: GameState, generalId: string, factionId: string, territoryId: string, changes: Partial<UnitState> = {}): GameState {
  const definition = generalUnitDefinition(scenario, unit(`general-${generalId}`));
  if (definition === undefined) throw new Error(`no general ${generalId}`);
  return {
    ...state,
    raised: { ...state.raised, [definition.id]: definition },
    units: { ...state.units, [definition.id]: { factionId: faction(factionId), fatigue: 0, id: definition.id, morale: { demoralized: false, quietTurns: 0 }, strength: definition.fullStrength, territoryId: territory(territoryId), ...changes } }
  };
}

function changed(state: GameState, id: string, changes: Partial<UnitState>): GameState {
  const current = state.units[unit(id)];
  if (current === undefined) throw new Error(`no unit ${id}`);
  return { ...state, units: { ...state.units, [id]: { ...current, ...changes } } };
}

function without(state: GameState, ...ids: readonly string[]): GameState {
  return { ...state, units: Object.fromEntries(Object.entries(state.units).filter(([id]) => !ids.includes(id))) };
}

const weatherIn = (state: GameState, zone: string, outcome: string): GameState => ({ ...state, weather: { outcomes: { [zone]: outcome } as never, roll: 10 } });

describe("canFight (D27.1)", () => {
  it("is a ground unit with an attack value", () => {
    const { scenario: field, state } = battlefield(scenario, ["infantry-regiment", "artillery-group", "militia-column", "truck-column", "anti-air-battery", "bomber-squadron"]
      .map((type): ArmySpec => ({ faction: "north", id: type, territory: "castilla-y-leon", type })));
    expect(Object.keys(state.units).map((id) => canFight(field, state.raised, unit(id)))).toEqual([true, true, true, false, false, false]);
    expect(canFight(scenario, opening.raised, unit("rep-general-miaja"))).toBe(false);
  });
});

describe("B1, D27.1: forces that cannot attack alone never attack", () => {
  it("lets the other side attack a meeting when artillery alone has the greater attack", () => {
    const { scenario: field, state } = board([
      { faction: "north", id: "art1", territory: "castilla-y-leon", type: "artillery-group" },
      { faction: "north", id: "art2", territory: "castilla-y-leon", type: "artillery-group" },
      { faction: "republic", id: "mil1", territory: "madrid", type: "militia-column" }
    ]);
    const result = resolveTurn(field, state, submit(
      move("north", "art1", "castilla-y-leon", "madrid"), move("north", "art2", "castilla-y-leon", "madrid"), move("republic", "mil1", "madrid", "castilla-y-leon")
    ), 7, loadedD20([10]));
    const [meeting] = battles(result);
    expect(meeting?.site.kind).toBe("meeting");
    expect(meeting?.attackerFactionId).toBe("republic");
  });

  it("bounces both sides of a meeting where neither can attack", () => {
    const { scenario: field, state } = board([
      { faction: "north", id: "art1", territory: "castilla-y-leon", type: "artillery-group" },
      { faction: "republic", id: "art2", territory: "madrid", type: "artillery-group" }
    ]);
    const result = resolveTurn(field, state, submit(move("north", "art1", "castilla-y-leon", "madrid"), move("republic", "art2", "madrid", "castilla-y-leon")), 7);
    expect(battles(result)).toEqual([]);
    expect(ofKind(result, "bounced-move").map((outcome) => outcome.order.unitId).sort()).toEqual(["art1", "art2"]);
  });

  it("turns back a lone general, a truck or anti-air battery attacking defended ground, without a battle", () => {
    for (const type of ["truck-column", "anti-air-battery"]) {
      const { scenario: field, state } = board([
        { faction: "north", id: "x1", territory: "castilla-y-leon", type },
        { faction: "republic", id: "r1", territory: "madrid", type: "infantry-regiment" }
      ]);
      const result = resolveTurn(field, state, submit(move("north", "x1", "castilla-y-leon", "madrid")), 7);
      expect(battles(result)).toEqual([]);
      expect(result.finalState.units[unit("x1")]?.territoryId).toBe("castilla-y-leon");
    }
    const general = board([{ faction: "republic", id: "r1", territory: "madrid", type: "infantry-regiment" }], { "north-general-mola": "castilla-y-leon" });
    const result = resolveTurn(general.scenario, general.state, submit(move("north", "north-general-mola", "castilla-y-leon", "madrid")), 7);
    expect(battles(result)).toEqual([]);
    expect(estimateAttack(general.scenario, general.state, faction("north"), [unit("north-general-mola")], territory("madrid"))).toMatchObject({ cannotAttack: true, kind: "battle" });
  });

  it("makes no standing attack with only generals and non-fighting units", () => {
    // Andalucia is contested from the start: Seville is the South's, Malaga the Republic's.
    const { scenario: field, state } = board([
      { faction: "republic", id: "r1", territory: "andalucia", type: "infantry-regiment", demoralized: true },
      { faction: "south", id: "s1", territory: "andalucia", type: "truck-column" }
    ], { "south-general-yague": "andalucia" });
    expect(battles(resolveTurn(field, state, [], 7))).toEqual([]);
  });
});

describe("B2, D27.4: the top of the fatigue track", () => {
  const tired = (withYague: boolean) => {
    const { scenario: field, state } = board([
      { faction: "south", id: "s1", territory: "andalucia", type: "colonial-veterans" },
      { faction: "south", id: "s2", territory: "andalucia", type: "colonial-veterans" },
      { faction: "republic", id: "r1", territory: "andalucia", type: "militia-column" }
    ], withYague ? { "south-general-yague": "andalucia" } : {});
    return { field, state: changed(changed(state, "s1", { fatigue: 3 }), "s2", { fatigue: 3 }) };
  };

  for (const withYague of [false, true]) {
    it(`demoralizes a unit at fatigue 3 that attacks again, ${withYague ? "and Yague's rally the same turn does not undo it" : "with no general"}`, () => {
      const { field, state } = tired(withYague);
      const result = resolveTurn(field, state, [], 3, loadedD20([12]));
      const [standing] = battles(result);
      expect(standing?.site.kind).toBe("standing");
      expect(standing?.attackerFactionId).toBe("south");
      const survivors = ["s1", "s2"].flatMap((id) => result.finalState.units[unit(id)] ?? []);
      expect(survivors.length).toBeGreaterThan(0);
      for (const survivor of survivors) expect([survivor.fatigue, survivor.morale.demoralized]).toEqual([3, true]);
      expect(ofKind(result, "fatigue")).toContainEqual(expect.objectContaining({ demoralized: true, fatigue: 3, unitId: survivors[0]?.id }));
      expect(ofKind(result, "rallied").flatMap((outcome) => outcome.unitIds)).toEqual([]);
      // Next turn they cannot attack (C4); the general rallies them at its end, as they started it demoralized.
      const next = resolveTurn(field, { ...result.finalState, turnNumber: 2 }, [], 3, loadedD20([12]));
      for (const survivor of survivors) expect(next.finalState.units[survivor.id]?.morale.demoralized).toBe(!withYague);
    });
  }

  it("never tires a general", () => {
    const { field, state } = tired(true);
    const result = resolveTurn(field, changed(state, "south-general-yague", { fatigue: 3 }), [], 3, loadedD20([12]));
    expect(result.finalState.units[unit("south-general-yague")]).toMatchObject({ fatigue: 3, morale: { demoralized: false } });
  });
});

describe("B3: a raid cut falls on the faction raided", () => {
  it("cuts the raided faction only while it holds the ground, never the raider who took it", () => {
    const cut: GameState = { ...opening, raidCuts: [{ factionId: faction("north"), subTerritoryId: "valladolid" as SubTerritoryId, turnNumber: 1 }] };
    expect(raidIncomeDelta({ factionId: faction("north"), income: {}, scenario, state: cut })).toEqual({ funds: -1, manpower: -3 });
    const taken = holdWhole(scenario, cut, territory("castilla-y-leon"), faction("republic"));
    expect(raidIncomeDelta({ factionId: faction("republic"), income: {}, scenario, state: taken })).toEqual({});
    expect(raidIncomeDelta({ factionId: faction("north"), income: {}, scenario, state: taken })).toEqual({});
  });

  it("records the holder at the time of the raid", () => {
    const raid = mission("republic", "rep-breguet-bombers", { kind: "raid", subTerritoryId: "burgos" as SubTerritoryId });
    for (let seed = 1; seed < 60; seed += 1) {
      const result = resolveTurn(scenario, opening, submit(raid), seed);
      if (ofKind(result, "raid")[0]?.result !== "income-cut") continue;
      expect(result.finalState.raidCuts).toEqual([{ factionId: "north", subTerritoryId: "burgos", turnNumber: 2 }]);
      return;
    }
    throw new Error("no seed gave an income cut");
  });
});

describe("B4, M2, D17: what counts as an army staying in a territory", () => {
  const southGround = ["south-granada-6", "south-lepanto-5", "south-cadiz-33", "south-africa-vanguard"];

  it("does not make an aircraft at its airfield into a reinforcement", () => {
    const state = without(opening, ...southGround);
    const order = move("south", "south-legion", "ceuta", "andalucia");
    expect(classifyMoves(scenario, state, state.units, [order])).toEqual({ advances: [order], reinforcements: [] });
    expect(estimateAttack(scenario, state, faction("south"), [unit("south-legion")], territory("andalucia")).kind).toBe("battle");
    const result = resolveTurn(scenario, state, submit(order), 5);
    expect(ofKind(result, "reinforcement-arrived")).toEqual([]);
    expect(battles(result)[0]?.site.kind).toBe("assault");
  });

  it("counts a general as staying under the d20, but not under the d6 table, where he is set aside", () => {
    const state = without(opening, ...southGround, "south-ju52-bombers");
    const placed = changed(state, "south-general-yague", { territoryId: territory("andalucia") });
    const order = move("south", "south-legion", "ceuta", "andalucia");
    expect(classifyMoves(scenario, placed, placed.units, [order]).reinforcements).toEqual([order]);
    expect(classifyMoves(onD6Dice(scenario), placed, placed.units, [order]).advances).toEqual([order]);
  });

  it("reads a territory held by an enemy general alone as defended, and one's own lone general as joining", () => {
    const keep = (id: string) => opening.units[unit(id)]?.territoryId !== "madrid" || ["rep-general-miaja", "rep-ni52-fighters", "rep-breguet-bombers"].includes(id);
    const lone: GameState = { ...opening, units: Object.fromEntries(Object.entries(opening.units).filter(([id]) => keep(id))) };
    const attackers = ["north-san-marcial-22", "north-san-quintin-25"].map(unit);
    expect(estimateAttack(scenario, lone, faction("north"), attackers, territory("madrid")).kind).toBe("battle");
    expect(estimateAttack(scenario, lone, faction("republic"), [unit("rep-castilla-3")], territory("madrid")).kind).toBe("reinforcement");
    const result = resolveTurn(scenario, lone, submit(...attackers.map((id) => move("north", id, "castilla-y-leon", "madrid"))), 3);
    expect(battles(result)[0]?.site).toMatchObject({ kind: "assault", territoryId: "madrid" });
  });
});

describe("M1: the move planner's board", () => {
  it("keeps enemy generals, so the estimate counts their +1 and trait, and drops aircraft and its own generals", () => {
    const view = movePlanningView(scenario, opening, faction("north"));
    expect(view.units[unit("rep-general-miaja")]).toBeDefined();
    expect(view.units[unit("north-general-mola")]).toBeUndefined();
    expect(view.units[unit("rep-breguet-bombers")]).toBeUndefined();
    const attackers = ["north-san-marcial-22", "north-san-quintin-25", "north-la-victoria-28"].map(unit);
    const estimate = estimateAttack(scenario, view, faction("north"), attackers, territory("madrid"));
    const resolved = estimateAttack(scenario, opening, faction("north"), attackers, territory("madrid"));
    expect(estimate.kind === "battle" ? estimate.modifiers : []).toEqual(resolved.kind === "battle" ? resolved.modifiers : ["missing"]);
    expect(estimate.kind === "battle" ? estimate.modifiers.map((modifier) => modifier.kind) : []).toEqual(expect.arrayContaining(["general", "trait"]));
  });
});

describe("M5, D5: one best general for the roll and the rally", () => {
  const pozas = unit("general-sebastian-pozas");
  const asensio = unit("general-jose-asensio");
  const both = withGeneral(withGeneral(opening, "sebastian-pozas", "republic", "andalucia"), "jose-asensio", "republic", "andalucia");

  it("ranks by bonus plus the trait for the role, then roster order", () => {
    // Pozas is cautious (-1 on attack), Asensio uninspiring (no rally, no roll).
    expect(bestGeneral(scenario, both.raised, [pozas, asensio], "attack")?.unitId).toBe(asensio);
    expect(bestGeneral(scenario, both.raised, [pozas, asensio], "defence")?.unitId).toBe(pozas);
    const side = gradedSide(scenario, both, [pozas, asensio].map((id) => ({ from: territory("andalucia"), unit: both.units[id]! })), "attack");
    expect(side.value).toBe(0);
  });

  it("rallies with the general who would count for the army's role: Pozas when it did not attack", () => {
    const { scenario: field, state } = board([{ faction: "republic", id: "r1", territory: "andalucia", type: "infantry-regiment", demoralized: true }]);
    const withPozas = withGeneral(withGeneral(state, "sebastian-pozas", "republic", "andalucia"), "jose-asensio", "republic", "andalucia");
    const result = resolveTurn(field, withPozas, [], 3);
    expect(ofKind(result, "rallied")).toEqual([{ factionId: "republic", generalId: "sebastian-pozas", kind: "rallied", territoryId: "andalucia", unitIds: ["r1"] }]);
    const alone = withGeneral(state, "jose-asensio", "republic", "andalucia");
    expect(ofKind(resolveTurn(field, alone, [], 3), "rallied")).toEqual([]);
  });
});

describe("M6: a general's death roll reads what the battles did", () => {
  it("rolls when break-up destroys every unit of his army on a grade that is not a rout", () => {
    const deadly: Scenario = { ...scenario, air: { ...scenario.air!, generalDeathRoll: 20 } };
    // Four worn regiments, each just above the break-up share: any loss of 10 percent breaks them all up.
    const worn = ["r1", "r2", "r3", "r4"];
    const { scenario: field, state } = board([
      { faction: "north", id: "n1", territory: "castilla-y-leon", type: "infantry-regiment" },
      ...worn.map((id): ArmySpec => ({ faction: "republic", fullStrength: 1000, id, strength: 105, territory: "madrid", type: "infantry-regiment" }))
    ], { "rep-general-miaja": "madrid" });
    const fielded: Scenario = { ...deadly, index: field.index, unitTypes: field.unitTypes, units: field.units };
    const attack = submit(move("north", "n1", "castilla-y-leon", "madrid"));
    const grades = new Map<string, (typeof scenario.d20 & object)["grades"][number]>(scenario.d20!.grades.map((grade) => [grade.id, grade]));
    let checked = false;
    for (let face = 1; face <= 20; face += 1) {
      const result = resolveTurn(fielded, state, attack, 3, loadedD20([face]));
      const grade = grades.get(battles(result)[0]?.grade ?? "");
      if (grade === undefined || grade.defender.lossPercent === 0 || grade.defender.lossPercent >= 100 || grade.defender.demoralized === "all") continue;
      for (const id of worn) expect(result.finalState.units[unit(id)]).toBeUndefined();
      expect(ofKind(result, "general-died").map((outcome) => outcome.generalId)).toEqual(["jose-miaja"]);
      checked = true;
    }
    expect(checked).toBe(true);
  });
});

describe("D27.7: where replacement generals appear", () => {
  const due: GameState = { ...opening, generals: { ...opening.generals, [faction("south")]: { nextIndex: 2, pending: [{ arrivesOnTurn: 1, generalId: "jose-varela" as never }] } } };

  it("appears in the seat while the faction holds its capital sub-territory, contested or not", () => {
    const result = resolveTurn(scenario, due, [], 3);
    expect(ofKind(result, "replacement-arrived")).toEqual([expect.objectContaining({ generalId: "jose-varela", territoryId: "andalucia" })]);
  });

  it("otherwise appears in the nearest territory whose capital the faction holds", () => {
    const lost: GameState = { ...due, subTerritories: { ...due.subTerritories, ["sevilla" as SubTerritoryId]: { ...due.subTerritories["sevilla" as SubTerritoryId]!, holder: faction("republic") } } };
    const result = resolveTurn(scenario, lost, [], 3);
    expect(ofKind(result, "replacement-arrived")).toEqual([expect.objectContaining({ generalId: "jose-varela", territoryId: "ceuta" })]);
  });
});

describe("D27.2: aircraft rebase whenever they lose their base", () => {
  const unpaved = (state: GameState, ...subs: readonly string[]): GameState => ({
    ...state,
    subTerritories: Object.fromEntries(Object.entries(state.subTerritories).map(([id, site]) => [id, subs.includes(id) ? { ...site, buildings: site.buildings.filter((building) => building !== "airfield") } : site]))
  });

  it("rebases from a territory with no airfield left, though its faction still holds it", () => {
    const result = resolveTurn(scenario, unpaved(opening, "madrid", "henares"), [], 3);
    expect(ofKind(result, "aircraft-rebased").map((outcome) => [outcome.unitId, outcome.to])).toEqual([["rep-breguet-bombers", "valencia"], ["rep-ni52-fighters", "valencia"]]);
  });

  it("rebases when the airfield's sub-territory is lost and the territory stays contested", () => {
    // No Republic army stays in Madrid to sweep the ground back at step 8 (P3).
    const emptied = without(opening, ...Object.values(opening.units).filter((value) => value.territoryId === "madrid" && !value.id.endsWith("fighters") && !value.id.endsWith("bombers")).map((value) => value.id));
    const flipped: GameState = { ...emptied, subTerritories: Object.fromEntries(Object.entries(emptied.subTerritories).map(([id, site]) => [id, ["madrid", "henares"].includes(id) ? { ...site, holder: faction("north") } : site])) };
    expect(ofKind(resolveTurn(scenario, flipped, [], 3), "aircraft-rebased").map((outcome) => outcome.unitId)).toEqual(["rep-breguet-bombers", "rep-ni52-fighters"]);
  });

  it("is lost with no airbase of its faction in range", () => {
    const bare = unpaved(opening, "madrid", "henares", "valencia", "barcelona");
    const result = resolveTurn(scenario, bare, [], 3);
    expect(ofKind(result, "aircraft-lost").map((outcome) => outcome.unitId)).toEqual(["rep-breguet-bombers", "rep-catalan-recon", "rep-ni52-fighters"]);
    expect(result.finalState.units[unit("rep-breguet-bombers")]).toBeUndefined();
  });
});

describe("D27.3: fighters intercept any mission over their territory", () => {
  const intercept = mission("republic", "rep-ni52-fighters", { kind: "intercept", territoryId: territory("madrid") });

  it("rolls against support: shot down, the bomber is lost and gives no support; else it flies", () => {
    const support = mission("south", "south-ju52-bombers", { kind: "support", territoryId: territory("madrid") });
    const seen = new Set<boolean>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const result = resolveTurn(scenario, opening, submit(intercept, support), seed);
      const [interception] = ofKind(result, "interception");
      expect(interception).toMatchObject({ factionId: "republic", interceptorIds: ["rep-ni52-fighters"], raiderIds: ["south-ju52-bombers"] });
      const shot = interception?.lostUnitIds.includes(unit("south-ju52-bombers")) === true;
      seen.add(shot);
      expect(result.finalState.units[unit("south-ju52-bombers")] === undefined).toBe(shot);
      expect(ofKind(result, "air-support").length).toBe(shot ? 0 : 1);
    }
    expect([...seen].sort()).toEqual([false, true]);
  });

  it("rolls against recon: shot down, nothing is revealed; else it reveals and stays private", () => {
    const recon = mission("north", "north-leon-recon", { kind: "recon", territoryId: territory("madrid") });
    const seen = new Set<boolean>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const result = resolveTurn(scenario, opening, submit(intercept, recon), seed);
      const shot = result.finalState.units[unit("north-leon-recon")] === undefined;
      seen.add(shot);
      expect(ofKind(result, "recon").length).toBe(shot ? 0 : 1);
      expect(ofKind(result, "interception")).toEqual(shot ? [expect.objectContaining({ lostUnitIds: ["north-leon-recon"] })] : []);
      expect(result.finalState.reveals.length).toBe(shot ? 0 : 1);
    }
    expect([...seen].sort()).toEqual([false, true]);
  });

  it("never intercepts a faction's own missions", () => {
    const own = mission("republic", "rep-breguet-bombers", { kind: "support", territoryId: territory("madrid") });
    expect(ofKind(resolveTurn(scenario, opening, submit(intercept, own), 1), "interception")).toEqual([]);
  });
});

describe("D27.5: meetings take the weather", () => {
  it("gives a meeting the weather modifier of the attackers' destination", () => {
    const { scenario: field, state } = board([
      { faction: "north", id: "n1", territory: "castilla-y-leon", type: "colonial-veterans" },
      { faction: "republic", id: "r1", territory: "madrid", type: "militia-column" }
    ]);
    const orders = submit(move("north", "n1", "castilla-y-leon", "madrid"), move("republic", "r1", "madrid", "castilla-y-leon"));
    const [muddy] = battles(resolveTurn(field, weatherIn(state, "meseta", "mud"), orders, 7, loadedD20([10])));
    expect(muddy?.site.kind).toBe("meeting");
    expect(muddy?.modifiers).toContainEqual({ kind: "weather", roll: -3, weatherId: "mud" });
    const [clear] = battles(resolveTurn(field, weatherIn(state, "meseta", "clear"), orders, 7, loadedD20([10])));
    expect(clear?.modifiers.some((modifier) => modifier.kind === "weather")).toBe(false);
  });
});

describe("D27.6: demoralization takes combat units first", () => {
  it("demoralizes the infantry before the truck and the anti-air battery on a half grade", () => {
    const { scenario: field, state } = board([
      { faction: "republic", id: "truck", territory: "madrid", type: "truck-column" },
      { faction: "republic", id: "flak", territory: "madrid", type: "anti-air-battery" },
      { faction: "republic", id: "foot", territory: "madrid", type: "infantry-regiment" }
    ]);
    const side = gradedSide(field, state, Object.values(state.units).map((value) => ({ from: value.territoryId, unit: value })), "defence");
    const casualties = applyGradeSide(field, state, { demoralized: "half", lossPercent: 0 }, side, state.units, 0.1);
    expect(casualties.demoralized).toEqual(["foot"]);
  });
});

describe("M8: frostbite and break-up", () => {
  it("destroys a unit that frostbite leaves below 10 percent of its full strength", () => {
    const { scenario: field, state } = board([
      { faction: "republic", fullStrength: 1000, id: "worn", strength: 104, territory: "madrid", type: "infantry-regiment" },
      { faction: "republic", fullStrength: 1000, id: "fresh", strength: 1000, territory: "madrid", type: "infantry-regiment" }
    ]);
    const cold = weatherIn(state, "meseta", "severe-cold");
    const result = resolveTurn(field, cold, submit(move("republic", "worn", "madrid", "castilla-la-mancha"), move("republic", "fresh", "madrid", "castilla-la-mancha")), 3);
    expect(ofKind(result, "frostbite")).toEqual([
      { destroyed: true, factionId: "republic", kind: "frostbite", men: 5, territoryId: "castilla-la-mancha", unitId: "worn" },
      { factionId: "republic", kind: "frostbite", men: 50, territoryId: "castilla-la-mancha", unitId: "fresh" }
    ]);
    expect(result.finalState.units[unit("worn")]).toBeUndefined();
    expect(result.finalState.units[unit("fresh")]?.strength).toBe(950);
    // The d6 table has no break-up (D6 is a d20 rule).
    const d6 = resolveTurn(onD6Dice(field), cold, submit(move("republic", "worn", "madrid", "castilla-la-mancha")), 3);
    expect(d6.finalState.units[unit("worn")]?.strength).toBe(99);
  });
});
