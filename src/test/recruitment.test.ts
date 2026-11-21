import { describe, expect, it } from "vitest";
import { requireUnitDefinition } from "../main/engine/lookup";
import { incomeFor } from "../main/engine/economy/income";
import { hookedReplenishBonus } from "../main/engine/hooks";
import { addResources, canAfford, scaleResources, subtractResources } from "../main/engine/resources";
import {
  isContested,
  raisedDefinition,
  raisedUnitId,
  recruitSlots,
  replenishProblem,
  replenishQuote,
  typeLock
} from "../main/engine/recruitment/rules";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type {
  GameState,
  RecruitOrder,
  ReplenishOrder,
  Resources,
  SubTerritoryId,
  TurnOutcome,
  UnitTypeId
} from "../main/engine/types";
import { validateOrder } from "../main/engine/validation";
import { faction, spain, territory, unit } from "./support";

const scenario = spain();
const republic = faction("republic");
const north = faction("north");
const type = (id: string): UnitTypeId => id as UnitTypeId;
const sub = (id: string): SubTerritoryId => id as SubTerritoryId;

const recruit = (factionId: string, territoryId: string, unitTypeId: string): RecruitOrder => ({
  factionId: faction(factionId), kind: "recruit", territoryId: territory(territoryId), unitTypeId: type(unitTypeId)
});
const replenishOrder = (factionId: string, unitId: string): ReplenishOrder => ({ factionId: faction(factionId), kind: "replenish", unitId: unit(unitId) });

function play(state: GameState, orders: readonly (RecruitOrder | ReplenishOrder)[], seed = 7) {
  const byFaction = scenario.factions.map((entry) => ({ factionId: entry.id, orders: orders.filter((order) => order.factionId === entry.id) }));
  return resolveTurn(scenario, state, byFaction, seed);
}
const ofKind = <Kind extends TurnOutcome["kind"]>(outcomes: readonly TurnOutcome[], kind: Kind) =>
  outcomes.filter((outcome): outcome is Extract<TurnOutcome, { kind: Kind }> => outcome.kind === kind);
const funded = (state: GameState, amount: Resources): GameState => ({ ...state, treasuries: { ...state.treasuries, [republic]: amount, [north]: amount } });

describe("resources", () => {
  it("adds, subtracts, scales up and checks a price", () => {
    expect(subtractResources({ funds: 5 } as Resources, { funds: 2, manpower: 1 } as Resources)).toEqual({ funds: 3, manpower: -1 });
    expect(scaleResources({ funds: 6, manpower: 1 } as Resources, 0.25)).toEqual({ funds: 2, manpower: 1 });
    expect(canAfford({ funds: 3 } as Resources, { funds: 3, manpower: 0 } as Resources)).toBe(true);
    expect(canAfford({ funds: 3 } as Resources, { manpower: 1 } as Resources)).toBe(false);
  });
});

describe("where and what a faction may recruit (R2, R3, D7)", () => {
  const start = initialGameState(scenario);

  it("recruits at the capital of an uncontested territory it holds", () => {
    expect(validateOrder(scenario, start, recruit("republic", "catalunya", "infantry-regiment"))).toEqual({ ok: true });
    expect(validateOrder(scenario, start, recruit("north", "catalunya", "infantry-regiment")).ok).toBe(false);
  });

  it("refuses contested ground, read from control or from sub-territory holders (W6, C8)", () => {
    expect(isContested(scenario, start, territory("asturias"))).toBe(true);
    // Pais Vasco is controlled by the Republic but Alava is held by the North (P1).
    expect(isContested(scenario, start, territory("pais-vasco"))).toBe(true);
    const result = validateOrder(scenario, start, recruit("republic", "pais-vasco", "militia-column"));
    expect(result).toEqual({ ok: false, reason: expect.stringContaining("contested") as string });
  });

  it("militia need no building; others need the capital's buildings, named inline", () => {
    expect(typeLock(scenario, start, north, territory("la-rioja"), scenario.index.unitTypes.get(type("militia-column"))!).reasons).toEqual([]);
    const lock = typeLock(scenario, start, north, territory("la-rioja"), scenario.index.unitTypes.get(type("artillery-group"))!);
    expect(lock.missingBuildings).toEqual(["barracks", "factory"]);
    expect(lock.reasons[0]).toMatch(/^Needs a Barracks and a Factory in /u);
  });

  it("limits types to factions (colonial veterans are not Republican)", () => {
    expect(validateOrder(scenario, start, recruit("republic", "catalunya", "colonial-veterans")).ok).toBe(false);
    expect(validateOrder(scenario, start, recruit("north", "castilla-y-leon", "colonial-veterans")).ok).toBe(true);
  });

  it("takes two orders a turn, three with a Factory (D7)", () => {
    expect(recruitSlots(scenario, start, territory("castilla-y-leon"))).toBe(2);
    expect(recruitSlots(scenario, start, territory("catalunya"))).toBe(3);
  });

  it("is refused outright under m2-strength rules (M9)", () => {
    const off = { ...scenario, rules: { ...scenario.rules, recruitment: "none" } };
    expect(validateOrder(off, start, recruit("republic", "catalunya", "militia-column")).ok).toBe(false);
  });
});

describe("Recruit orders through the turn (R4, R6, R7)", () => {
  const start = funded(initialGameState(scenario), { funds: 30, manpower: 10 } as Resources);

  it("pays at reveal, trains, and appears at the end of the last training turn", () => {
    const turn1 = play(start, [recruit("republic", "catalunya", "militia-column"), recruit("republic", "catalunya", "infantry-regiment")]);
    const started = ofKind(turn1.outcomes, "training-started");
    expect(started.map((outcome) => outcome.turnsLeft)).toEqual([1, 2]);
    // Militia (1 turn) appear at the end of the turn they were ordered; they can first move next turn.
    const militiaId = raisedUnitId(republic, type("militia-column"), 1);
    expect(turn1.finalState.units[militiaId]).toMatchObject({ strength: 2500, territoryId: "catalunya", fatigue: 0 });
    expect(turn1.finalState.raised[militiaId]?.name).toBe("Militia column No. 1");
    // Paid 8 Funds and 4 Manpower, then step 11's income ($2, m3r1-economy-builds), on the ground
    // held after step 8 (the turn-1 flips take Alava and Caceres, R2).
    expect(turn1.finalState.treasuries[republic]).toEqual(addResources({ funds: 22, manpower: 6 } as Resources, incomeFor(scenario, { ...start, subTerritories: turn1.finalState.subTerritories }, republic).paid));
    expect(turn1.finalState.training).toHaveLength(1);

    const turn2 = play({ ...turn1.finalState, turnNumber: 2 }, []);
    const infantryId = raisedUnitId(republic, type("infantry-regiment"), 1);
    expect(ofKind(turn2.outcomes, "training-completed").map((outcome) => outcome.unitId)).toEqual([infantryId]);
    expect(turn2.finalState.training).toHaveLength(0);
    expect(requireUnitDefinition(scenario, infantryId)).toMatchObject({ fullStrength: 700, type: "infantry-regiment" });
  });

  it("refunds past the D7 limit and when funds run out", () => {
    const poor = funded(initialGameState(scenario), { funds: 4, manpower: 10 } as Resources);
    const result = play(poor, [
      recruit("republic", "valencia", "militia-column"),
      recruit("republic", "valencia", "militia-column"),
      recruit("republic", "madrid", "militia-column")
    ]);
    expect(ofKind(result.outcomes, "training-started")).toHaveLength(2);
    expect(ofKind(result.outcomes, "training-refunded").map((outcome) => outcome.reason)).toEqual([expect.stringContaining("Not enough") as string]);
    // m1: nothing was taken, so the refusal refunds nothing.
    expect(ofKind(result.outcomes, "training-refunded").map((outcome) => outcome.refund)).toEqual([{}]);
    const crowded = play(funded(initialGameState(scenario), { funds: 99, manpower: 99 } as Resources), [1, 2, 3].map(() => recruit("north", "castilla-y-leon", "militia-column")));
    expect(ofKind(crowded.outcomes, "training-refunded").map((outcome) => outcome.reason)).toEqual([expect.stringContaining("At most 2") as string]);
  });

  it("C8: other types pause while their territory is contested; militia finish; a fallen capital loses it", () => {
    const base = initialGameState(scenario);
    const item = (typeId: string, serial: number) => ({
      factionId: republic, paid: {}, paused: false, territoryId: territory("catalunya"), turnsLeft: 1, typeId: type(typeId), unitId: raisedUnitId(republic, type(typeId), serial)
    });
    const lerida = sub("lleida");
    const contested: GameState = {
      ...base,
      // No army in Catalunya, so nobody flips Lleida back before training advances (R2).
      units: Object.fromEntries(Object.entries(base.units).filter(([, entry]) => entry.territoryId !== "catalunya")),
      subTerritories: { ...base.subTerritories, [lerida]: { ...base.subTerritories[lerida]!, holder: north } },
      training: [item("militia-column", 1), item("infantry-regiment", 1)]
    };
    const result = play(contested, []);
    expect(ofKind(result.outcomes, "training-completed").map((outcome) => outcome.typeId)).toEqual(["militia-column"]);
    expect(ofKind(result.outcomes, "training-paused").map((outcome) => outcome.unitId)).toEqual([raisedUnitId(republic, type("infantry-regiment"), 1)]);
    expect(result.finalState.training).toEqual([{ ...item("infantry-regiment", 1), paused: true }]);

    const barcelona = sub("barcelona");
    const fallen: GameState = { ...contested, subTerritories: { ...contested.subTerritories, [barcelona]: { ...base.subTerritories[barcelona]!, holder: north } } };
    expect(ofKind(play(fallen, []).outcomes, "training-refunded")).toHaveLength(2);
  });

  it("D28.2: a fallen capital refunds training not yet started and keeps the payment of training under way", () => {
    const base = initialGameState(scenario);
    const barcelona = sub("barcelona");
    const paid = { funds: 6, manpower: 1 } as Resources;
    const item = (serial: number, turnsLeft: number) => ({
      factionId: republic, paid, paused: false, territoryId: territory("catalunya"), turnsLeft, typeId: type("infantry-regiment"), unitId: raisedUnitId(republic, type("infantry-regiment"), serial)
    });
    const fallen: GameState = {
      ...base,
      units: Object.fromEntries(Object.entries(base.units).filter(([, entry]) => entry.territoryId !== "catalunya")),
      subTerritories: { ...base.subTerritories, [barcelona]: { ...base.subTerritories[barcelona]!, holder: north } },
      // Serial 1 was paid this turn's reveal (2 turns left of 2); serial 2 has trained a turn.
      training: [item(1, 2), item(2, 1)],
      treasuries: { ...base.treasuries, [republic]: { funds: 0, manpower: 0 } as Resources }
    };
    const result = play(fallen, []);
    const refunds = ofKind(result.outcomes, "training-refunded");
    expect(refunds.map((outcome) => outcome.refund)).toEqual([paid, {}]);
    expect(refunds[0]!.reason).toMatch(/before training began/u);
    expect(result.finalState.training).toEqual([]);
    const income = ofKind(result.outcomes, "income").find((outcome) => outcome.factionId === republic)!.paid;
    expect(result.finalState.treasuries[republic]).toEqual(addResources(paid, income));
  });
});

describe("Replenish (R5)", () => {
  const base = funded(initialGameState(scenario), { funds: 20, manpower: 10 } as Resources);
  const durruti = Object.values(base.units).find((entry) => entry.factionId === republic && entry.territoryId === "catalunya")!;
  const worn: GameState = { ...base, units: { ...base.units, [durruti.id]: { ...durruti, morale: { demoralized: true, quietTurns: 0 }, strength: Math.round(durruti.strength / 4) } } };

  it("quotes half the recruit price per value point, capped at half the full strength a turn", () => {
    const quote = replenishQuote(scenario, worn, worn.units[durruti.id]!)!;
    const full = requireUnitDefinition(scenario, durruti.id).fullStrength;
    // Half the full strength, plus the Depot's cap share through the replenishBonus hook (m3r1-economy-builds).
    const bonus = hookedReplenishBonus({ scenario, state: worn, territoryId: durruti.territoryId, unitId: durruti.id });
    expect(quote.men).toBe(Math.min(Math.floor(full * (0.5 + bonus.capShare)), full - worn.units[durruti.id]!.strength));
    expect(quote.recovers).toBe(true);
    // B2: it owes a share of every resource of the Recruit cost, in thousandths of a point.
    expect(Object.values(quote.owed).every((amount) => amount > 0)).toBe(true);
  });

  it("restores men and morale after battles, paid at reveal", () => {
    const result = play(worn, [replenishOrder("republic", durruti.id)]);
    const applied = ofKind(result.outcomes, "replenish-applied");
    expect(applied).toHaveLength(1);
    expect(applied[0]?.recovered).toBe(true);
    expect(result.finalState.units[durruti.id]?.strength).toBe(worn.units[durruti.id]!.strength + applied[0]!.men);
    expect(result.finalState.units[durruti.id]?.morale.demoralized).toBe(false);
  });

  it("is refused at full strength and in contested ground", () => {
    expect(replenishProblem(scenario, base, base.units[durruti.id]!)).toMatch(/full strength/u);
    // RR-12: a demoralized unit at full strength cannot replenish for nothing; it rests or is rallied.
    const shaken = { ...base.units[durruti.id]!, morale: { ...base.units[durruti.id]!.morale, demoralized: true } };
    const shakenState: GameState = { ...base, units: { ...base.units, [durruti.id]: shaken } };
    expect(replenishProblem(scenario, shakenState, shaken)).toMatch(/full strength\. It recovers its morale by resting, or with a general's rally\./u);
    expect(validateOrder(scenario, shakenState, replenishOrder("republic", durruti.id))).toEqual({ ok: false, reason: replenishProblem(scenario, shakenState, shaken) });
    // Below strength, a demoralized unit still replenishes and recovers (C5).
    const short = { ...shaken, strength: shaken.strength - 100 };
    expect(replenishProblem(scenario, { ...shakenState, units: { ...shakenState.units, [durruti.id]: short } }, short)).toBeUndefined();
    const inAsturias = Object.values(base.units).find((entry) => entry.territoryId === "asturias")!;
    expect(replenishProblem(scenario, base, { ...inAsturias, strength: 1 })).toMatch(/contested/u);
  });

  it("any battle cancels it with a refund", () => {
    const attacker = Object.values(base.units).find((entry) => entry.factionId === north && entry.territoryId === "aragon")!;
    // Aragon whole for the North (Huesca taken): units cannot move out of contested ground (C1, m3r1-sub-territories).
    const huesca = sub("huesca");
    const northAragon: GameState = {
      ...worn,
      control: { ...worn.control, [territory("aragon")]: { factionId: north, kind: "controlled" } },
      subTerritories: { ...worn.subTerritories, [huesca]: { ...worn.subTerritories[huesca]!, holder: north } }
    };
    const result = resolveTurn(scenario, northAragon, [
      { factionId: republic, orders: [replenishOrder("republic", durruti.id)] },
      { factionId: north, orders: [{ factionId: north, from: territory("aragon"), kind: "move", to: territory("catalunya"), unitId: attacker.id }] }
    ], 3);
    const cancelled = ofKind(result.outcomes, "replenish-cancelled");
    expect(cancelled).toHaveLength(1);
    // Refunded in full; only step 11's income ($2) is added.
    expect(result.finalState.treasuries[republic]).toEqual(addResources(worn.treasuries[republic]!, incomeFor(scenario, { ...worn, subTerritories: result.finalState.subTerritories }, republic).paid));
  });
});

describe("recruited units in the rest of the engine (R6)", () => {
  it("derive a definition from their id and fight like any unit", () => {
    const id = raisedUnitId(north, type("militia-column"), 4);
    expect(raisedDefinition(scenario, id)).toEqual({ factionId: "north", fullStrength: 2500, id, name: "Militia column No. 4", type: "militia-column" });
    expect(raisedDefinition(scenario, unit("rep-wad-ras-1"))).toBeUndefined();
    const base = initialGameState(scenario);
    const state: GameState = { ...base, units: { ...base.units, [id]: { factionId: north, fatigue: 0, id, morale: { demoralized: false, quietTurns: 0 }, strength: 2500, territoryId: territory("aragon") } } };
    const target = Object.values(base.units).find((entry) => entry.factionId === republic && entry.territoryId === "catalunya")!;
    const result = resolveTurn(scenario, state, [{ factionId: north, orders: [{ factionId: north, from: territory("aragon"), kind: "move", to: territory("catalunya"), unitId: id }] }], 5);
    expect(result.outcomes.some((outcome) => outcome.kind === "battle")).toBe(true);
    expect(target).toBeDefined();
  });
});
