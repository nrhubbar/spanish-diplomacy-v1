import { describe, expect, it } from "vitest";
import { orderPrice, balanceLeft } from "../main/ai/orders/spending";
import { seededBattleDice, seededRollStreams } from "../main/engine/dice";
import { startDraft } from "../main/engine/phases/draft";
import { advanceTraining, payForRecruits, replenish } from "../main/engine/recruitment/phases";
import {
  capitalOf,
  holdsTerritory,
  raisedDefinition,
  raisedOrder,
  raisedUnitId,
  recruitSiteProblem,
  recruitSlots,
  replenishProblem,
  replenishQuote,
  typeLock,
  validateRecruitOrder,
  validateReplenishOrder
} from "../main/engine/recruitment/rules";
import { initialGameState } from "../main/engine/resolution";
import type { GameState, PlayerSubmission, Resources, Scenario, TerritoryId, UnitId, UnitState, UnitTypeId } from "../main/engine/types";
import { faction, spainD20, territory, tiny, unit } from "./support";

/** The recruitment module's rules and engine parts, branch by branch (R2-R7, C8). */

const scenario = spainD20();
const republic = faction("republic");
const north = faction("north");
const type = (id: string): UnitTypeId => id as UnitTypeId;
const typeOf = (id: string) => scenario.index.unitTypes.get(type(id))!;
const regimentId = unit("rep-sevilla-34");
const murcia = territory("murcia");
const funded = (state: GameState): GameState => ({ ...state, treasuries: { ...state.treasuries, [republic]: { funds: 30, manpower: 30 } as Resources } });

/** Spain with Murcia's capital removed from the index, as a scenario without sub-territories would read. */
function withoutCapital(target: Scenario, territoryId: TerritoryId): Scenario {
  const territories = new Map(target.index.territories);
  const entry = { ...territories.get(territoryId)! };
  delete (entry as { capitalSubTerritoryId?: unknown }).capitalSubTerritoryId;
  territories.set(territoryId, entry);
  return { ...target, index: { ...target.index, territories } };
}

describe("recruiting sites and types (R2, R3, D7)", () => {
  const start = initialGameState(scenario);

  it("says when recruiting is not part of the scenario, or the site is not held", () => {
    expect(recruitSiteProblem(tiny(), initialGameState(tiny()), faction("red"), territory("westfold"))).toMatch(/not part of this scenario/u);
    expect(recruitSiteProblem(scenario, start, north, murcia)).toBe("You must hold Murcia to recruit there.");
    expect(holdsTerritory(scenario, start, republic, murcia)).toBe(true);
    // A territory whose capital another faction holds is not held for recruiting.
    const lost: GameState = { ...start, subTerritories: { ...start.subTerritories, ["murcia" as never]: { ...start.subTerritories["murcia" as never]!, holder: north } } };
    expect(holdsTerritory(scenario, lost, republic, murcia)).toBe(false);
  });

  it("locks a type that cannot be recruited, and names the territory when it has no capital", () => {
    expect(typeLock(scenario, start, republic, murcia, typeOf("general")).reasons).toEqual(["General cannot be recruited."]);
    const capitalless = withoutCapital(scenario, murcia);
    expect(capitalOf(capitalless, murcia)).toBeUndefined();
    expect(holdsTerritory(capitalless, start, republic, murcia)).toBe(true);
    // No capital: no capital buildings, so a Barracks is missing "in Murcia" (the territory).
    expect(typeLock(capitalless, start, republic, murcia, typeOf("infantry-regiment")).reasons).toEqual(["Needs a Barracks in Murcia."]);
    expect(recruitSlots(capitalless, start, murcia)).toBe(2);
  });

  it("counts a Factory's extra Recruit order", () => {
    expect(recruitSlots(scenario, start, territory("catalunya"))).toBe(3);
    expect(recruitSlots(tiny(), initialGameState(tiny()), territory("westfold"))).toBe(0);
  });

  it("refuses unknown types and territories", () => {
    expect(validateRecruitOrder(scenario, start, { factionId: republic, kind: "recruit", territoryId: murcia, unitTypeId: type("dragoons") })).toEqual({ ok: false, reason: "Unknown unit type." });
    expect(validateRecruitOrder(scenario, start, { factionId: republic, kind: "recruit", territoryId: territory("atlantis"), unitTypeId: type("militia-column") })).toEqual({ ok: false, reason: "Unknown territory." });
    expect(validateRecruitOrder(scenario, start, { factionId: republic, kind: "recruit", territoryId: murcia, unitTypeId: type("militia-column") })).toEqual({ ok: true });
  });
});

describe("recruited unit ids (R6)", () => {
  it("parses only well-formed ids of known factions and recruitable types", () => {
    expect(raisedDefinition(scenario, "r_republic" as UnitId)).toBeUndefined();
    expect(raisedDefinition(scenario, "x_republic_militia-column_1" as UnitId)).toBeUndefined();
    expect(raisedDefinition(scenario, "r_republic_militia-column_0" as UnitId)).toBeUndefined();
    expect(raisedDefinition(scenario, "r_republic_militia-column_one" as UnitId)).toBeUndefined();
    expect(raisedDefinition(scenario, "r_atlantis_militia-column_1" as UnitId)).toBeUndefined();
    expect(raisedDefinition(scenario, "r_republic_general_1" as UnitId)).toBeUndefined();
    expect(raisedOrder(scenario, "r_republic_dragoons_1" as UnitId)).toBeUndefined();
    expect(raisedOrder(scenario, regimentId)).toBeUndefined();
    expect(raisedOrder(scenario, raisedUnitId(republic, type("militia-column"), 1))).toBeGreaterThanOrEqual(scenario.units.length);
  });
});

describe("who may replenish (R5, RR-12)", () => {
  const start = funded(initialGameState(scenario));
  const regiment = start.units[regimentId]!;

  it("names every reason a unit cannot", () => {
    expect(validateReplenishOrder(scenario, start, { factionId: republic, kind: "replenish", unitId: unit("ghost") })).toEqual({ ok: false, reason: "Unknown unit." });
    expect(validateReplenishOrder(scenario, start, { factionId: north, kind: "replenish", unitId: regimentId })).toEqual({ ok: false, reason: "Selected unit belongs to another player." });
    expect(replenishProblem(scenario, start, { ...regiment, id: unit("ghost") })).toBe("Replenishing is not part of this scenario.");
    expect(replenishProblem(tiny(), initialGameState(tiny()), Object.values(initialGameState(tiny()).units)[0]!)).toBe("Replenishing is not part of this scenario.");
    const fighters = start.units[unit("rep-ni52-fighters")]!;
    expect(replenishProblem(scenario, start, { ...fighters, strength: 1 })).toBe("Fighter squadron units cannot replenish.");
    expect(replenishProblem(scenario, start, { ...regiment, strength: 100, territoryId: territory("navarra") })).toBe("Units replenish only in territory you hold.");
    expect(replenishProblem(scenario, start, regiment)).toBe("This unit is at full strength and in good order.");
    expect(replenishProblem(scenario, start, { ...regiment, morale: { demoralized: true, quietTurns: 0 } })).toMatch(/recovers its morale by resting/u);
    expect(validateReplenishOrder(scenario, { ...start, units: { ...start.units, [regimentId]: { ...regiment, strength: 100 } } }, { factionId: republic, kind: "replenish", unitId: regimentId })).toEqual({ ok: true });
  });

  it("quotes a recruited unit from the state's record, and nothing for a unit it does not know", () => {
    const id = raisedUnitId(republic, type("infantry-regiment"), 3);
    const raised: UnitState = { factionId: republic, fatigue: 0, id, morale: { demoralized: false, quietTurns: 0 }, strength: 100, territoryId: murcia };
    const state: GameState = { ...start, raised: { [id]: raisedDefinition(scenario, id)! }, units: { ...start.units, [id]: raised } };
    expect(replenishQuote(scenario, state, raised)?.men).toBe(350);
    expect(replenishQuote(scenario, state, { ...raised, id: unit("ghost") })).toBeUndefined();
    expect(replenishQuote(tiny(), initialGameState(tiny()), raised)).toBeUndefined();
  });
});

describe("the recruitment engine parts, on their own (RR4-RR8)", () => {
  const start = funded(initialGameState(scenario));
  const draftOf = (state: GameState, submissions: readonly PlayerSubmission[] = []) =>
    startDraft({ dice: seededBattleDice(1, 1), scenario, seed: 1, start: state, streams: seededRollStreams(1, state.turnNumber), submissions });

  it("pays nothing, and changes nothing, without orders or training", () => {
    const draft = draftOf(start);
    expect(payForRecruits(draft)).toBe(draft);
    expect(replenish(draft)).toBe(draft);
    expect(advanceTraining({ ...draft, systems: { ...draft.systems, training: [] } })).toEqual({ ...draft, systems: { ...draft.systems, training: [] } });
  });

  it("skips orders it cannot price: an unknown type or a unit no longer there", () => {
    const draft = draftOf(start, [{ factionId: republic, orders: [
      { factionId: republic, kind: "recruit", territoryId: murcia, unitTypeId: type("dragoons") },
      { factionId: republic, kind: "replenish", unitId: unit("ghost") }
    ] }]);
    const paid = payForRecruits(draft);
    expect(paid.events).toEqual([]);
    expect(paid.systems.treasuries).toEqual(start.treasuries);
  });

  it("cancels with a refund when the unit fell back, and stops at full strength", () => {
    const worn: GameState = { ...start, units: { ...start.units, [regimentId]: { ...start.units[regimentId]!, strength: 500 } } };
    const order = { factionId: republic, kind: "replenish", unitId: regimentId } as const;
    const paid = payForRecruits(draftOf(worn, [{ factionId: republic, orders: [order] }]));
    const charged = paid.scratch.recruitment!.replenishing[0]!.paid;
    // The unit ends the turn elsewhere (a retreat with no battle of its own).
    const fell = replenish({ ...paid, armies: { ...paid.armies, [regimentId]: { ...paid.armies[regimentId]!, territoryId: territory("valencia") } } });
    expect(fell.events.at(-1)).toEqual({ kind: "replenish-cancelled", order, reason: "The unit fell back.", refund: charged });
    expect(fell.systems.treasuries[republic]).toEqual(worn.treasuries[republic]);
    // It took men from elsewhere meanwhile: only what is still missing joins.
    const topped = replenish({ ...paid, armies: { ...paid.armies, [regimentId]: { ...paid.armies[regimentId]!, strength: 700 } } });
    expect(topped.events.at(-1)).toMatchObject({ kind: "replenish-applied", men: 75 });
    expect(topped.armies[regimentId]!.strength).toBe(775);
  });

  it("keeps training in a territory without a capital while its faction controls it, and loses it otherwise", () => {
    const capitalless = withoutCapital(scenario, murcia);
    const item = { factionId: republic, paid: {}, paused: false, territoryId: murcia, turnsLeft: 2, typeId: type("infantry-regiment"), unitId: raisedUnitId(republic, type("infantry-regiment"), 1) };
    const draft = { ...startDraft({ dice: seededBattleDice(1, 1), scenario: capitalless, seed: 1, start, streams: seededRollStreams(1, 1), submissions: [] }) };
    const training = { ...draft, systems: { ...draft.systems, training: [item] } };
    expect(advanceTraining(training).systems.training).toEqual([{ ...item, turnsLeft: 1 }]);
    const lost = { ...training, control: { ...training.control, control: { ...training.control.control, [murcia]: { factionId: north, kind: "controlled" as const } } } };
    expect(advanceTraining(lost).systems.training).toEqual([]);
    const shared = { ...training, control: { ...training.control, control: { ...training.control.control, [murcia]: { factionIds: [republic, north], kind: "contested" as const } } } };
    expect(advanceTraining(shared).events.some((event) => event.kind === "training-refunded")).toBe(false);
    const gone = { ...training, control: { ...training.control, control: { ...training.control.control, [murcia]: { factionIds: [north], kind: "contested" as const } } } };
    expect(advanceTraining(gone).systems.training).toEqual([]);
    // An item whose id names no recruitable type is dropped when it finishes.
    const odd = { ...training, systems: { ...training.systems, training: [{ ...item, turnsLeft: 1, unitId: unit("odd") }] } };
    expect(advanceTraining(odd).systems.training).toEqual([]);
    expect(advanceTraining(odd).armies[unit("odd")]).toBeUndefined();
  });
});

describe("the computer player's prices (H5)", () => {
  const start = funded(initialGameState(scenario));
  const worn: GameState = { ...start, units: { ...start.units, [regimentId]: { ...start.units[regimentId]!, strength: 100 } } };
  const context = { factionId: republic, memory: {}, planned: [], random: { next: () => 0 } as never, scenario, state: worn };

  it("prices Build, Recruit and Replenish orders, and nothing else", () => {
    expect(orderPrice(context, { factionId: republic, kind: "build", project: { buildingId: "hospital", kind: "building" } as never, subTerritoryId: "murcia" as never })).toEqual({ funds: 6 });
    expect(orderPrice(context, { factionId: republic, kind: "build", project: { buildingId: "castle", kind: "building" } as never, subTerritoryId: "murcia" as never })).toEqual({});
    expect(orderPrice(context, { factionId: republic, kind: "recruit", territoryId: murcia, unitTypeId: type("militia-column") })).toEqual({ funds: 2, manpower: 3 });
    expect(orderPrice(context, { factionId: republic, kind: "recruit", territoryId: murcia, unitTypeId: type("dragoons") })).toEqual({});
    expect(orderPrice(context, { factionId: republic, kind: "replenish", unitId: regimentId })).toEqual(replenishQuote(scenario, worn, worn.units[regimentId]!)!.cost);
    expect(orderPrice(context, { factionId: republic, kind: "replenish", unitId: unit("ghost") })).toEqual({});
    expect(orderPrice(context, { factionId: republic, from: murcia, kind: "move", to: territory("valencia"), unitId: regimentId })).toEqual({});
  });

  it("leaves the balance less what the planned orders cost, Replenish priced in turn", () => {
    const planned = [
      { factionId: republic, kind: "recruit", territoryId: murcia, unitTypeId: type("militia-column") } as const,
      { factionId: republic, kind: "replenish", unitId: regimentId } as const,
      { factionId: republic, kind: "replenish", unitId: unit("ghost") } as const
    ];
    const cost = replenishQuote(scenario, worn, worn.units[regimentId]!)!.cost as Record<string, number>;
    expect(balanceLeft({ ...context, planned })).toEqual({ funds: 28 - (cost["funds"] ?? 0), manpower: 27 - (cost["manpower"] ?? 0) });
  });
});
