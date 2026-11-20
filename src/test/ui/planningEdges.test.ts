import { describe, expect, it } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import type { GameState, ReplenishOrder, Scenario, UnitTypeId } from "../../main/engine/types";
import {
  basketCost,
  blockedOrders,
  canReplenishSelection,
  chooseReplenish,
  draftOrders,
  enemyPresent,
  inContestedGround,
  keepBasket,
  type PlanningSession,
  recruitQuantity,
  replenishWithout,
  selectedWithdrawRoutes,
  setRecruitQuantity,
  withdrawDestinations
} from "../../main/state/planning";
import { emptyDraft } from "../../main/state/session";
import { armyIn, faction, spain, spainId, spainM2, territory, unit } from "../support";

const republic = faction("republic");
const type = (id: string): UnitTypeId => id as UnitTypeId;
const catalunya = territory("catalunya");

function planning(state: GameState, draft = emptyDraft): PlanningSession {
  return { draft, factionId: republic, game: { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state }, phase: "planning" };
}

const replenish = (unitId: string): ReplenishOrder => ({ factionId: republic, kind: "replenish", unitId: unit(unitId) });

describe("the Recruit basket's edges (X4, R2)", () => {
  const scenario = spain();
  const state = initialGameState(scenario);

  it("ignores an unknown type and floors the quantity at zero", () => {
    const session = planning(state);
    expect(setRecruitQuantity(scenario, session, catalunya, type("no-such-type"), 2)).toBe(session);
    const two = setRecruitQuantity(scenario, session, catalunya, type("militia-column"), 2.7);
    expect(recruitQuantity(two.draft, catalunya, type("militia-column"))).toBe(2);
    const none = setRecruitQuantity(scenario, two, catalunya, type("militia-column"), -3);
    expect(recruitQuantity(none.draft, catalunya, type("militia-column"))).toBe(0);
    expect(none.draft.recruits).toEqual([]);
  });

  it("clears earlier feedback once a quantity is accepted", () => {
    const refused = setRecruitQuantity(scenario, planning(state), catalunya, type("colonial-veterans"), 1);
    expect(refused.draft.feedback).toMatch(/Not raised/u);
    expect(setRecruitQuantity(scenario, refused, catalunya, type("militia-column"), 1).draft.feedback).toBeUndefined();
  });

  it("refuses a recruit where the scenario has no recruitment", () => {
    const noRecruiting = { ...scenario };
    delete (noRecruiting as { recruitment?: unknown }).recruitment;
    expect(setRecruitQuantity(noRecruiting, planning(state), catalunya, type("militia-column"), 1).draft.feedback).toBe("Recruiting is not part of this scenario.");
  });

  it("costs recruits of unknown types and replenishments of missing units as nothing", () => {
    const draft = { ...emptyDraft, recruits: [{ factionId: republic, kind: "recruit" as const, territoryId: catalunya, unitTypeId: type("no-such-type") }], replenishments: [replenish("no-such-unit")] };
    expect(basketCost(scenario, planning(state, draft))).toEqual({});
  });

  it("lists every order the draft submits, moves first", () => {
    const draft = {
      ...emptyDraft,
      builds: [{ buildingId: "barracks", factionId: republic, kind: "build", subTerritoryId: "lleida" }] as never,
      recruits: [{ factionId: republic, kind: "recruit" as const, territoryId: catalunya, unitTypeId: type("militia-column") }],
      replenishments: [replenish("rep-wad-ras-1")]
    };
    expect(draftOrders(draft).map((order) => order.kind)).toEqual(["replenish", "recruit", "build"]);
    expect(draftOrders(emptyDraft)).toEqual([]);
  });

  it("keeps only the parts of the basket the draft has", () => {
    expect(keepBasket(emptyDraft)).toEqual({});
    const recruits = [{ factionId: republic, kind: "recruit" as const, territoryId: catalunya, unitTypeId: type("militia-column") }];
    expect(keepBasket({ ...emptyDraft, recruits })).toEqual({ recruits });
    expect(replenishWithout(emptyDraft, ["rep-wad-ras-1"])).toEqual({});
    expect(replenishWithout({ ...emptyDraft, replenishments: [replenish("rep-wad-ras-1"), replenish("rep-covadonga-4")] }, ["rep-wad-ras-1"]))
      .toEqual({ replenishments: [replenish("rep-covadonga-4")] });
  });
});

describe("the Replenish order's edges (R5)", () => {
  const scenario = spain();
  const base = initialGameState(scenario);
  const wadRas = armyIn(base, "rep-wad-ras-1");
  const covadonga = armyIn(base, "rep-covadonga-4");
  const worn: GameState = {
    ...base,
    units: { ...base.units, [wadRas.id]: { ...wadRas, strength: Math.round(wadRas.strength / 2) }, [covadonga.id]: { ...covadonga, strength: Math.round(covadonga.strength / 2) } }
  };

  it("asks for a selection first", () => {
    expect(canReplenishSelection(scenario, planning(worn))).toBe(false);
    expect(chooseReplenish(scenario, planning(worn)).draft.feedback).toBe("Select at least one unit first.");
  });

  it("refuses a unit at full strength with the engine's reason", () => {
    const session = planning(base, { orders: [], selectedTerritoryId: territory("madrid"), selectedUnitIds: [wadRas.id] });
    expect(canReplenishSelection(scenario, session)).toBe(false);
    expect(chooseReplenish(scenario, session).draft.feedback).toBe("This unit is at full strength and in good order.");
  });

  it("plans several units at once, keeping the territory selected", () => {
    const session = planning(worn, { orders: [], selectedTerritoryId: territory("madrid"), selectedUnitIds: [wadRas.id, covadonga.id] });
    expect(canReplenishSelection(scenario, session)).toBe(true);
    const planned = chooseReplenish(scenario, session);
    expect(planned.draft.feedback).toBe("2 units will replenish.");
    expect(planned.draft.replenishments?.map((order) => order.unitId)).toEqual([wadRas.id, covadonga.id]);
    expect(planned.draft.selectedTerritoryId).toBe("madrid");
    expect(planned.draft.selectedUnitIds).not.toContain(wadRas.id);
  });

  it("plans a unit selected without a territory, and clears the selection", () => {
    const session = planning(worn, { orders: [], replenishments: [replenish("rep-covadonga-4")], selectedUnitIds: [wadRas.id] });
    const planned = chooseReplenish(scenario, session);
    expect(planned.draft.feedback).toBe("1 unit will replenish.");
    expect(planned.draft.selectedUnitIds).toEqual([]);
    expect(planned.draft.selectedTerritoryId).toBeUndefined();
    expect(planned.draft.replenishments?.map((order) => order.unitId)).toEqual(["rep-covadonga-4", wadRas.id]);
  });
});

describe("contested ground in planning (C1)", () => {
  const scenario = spain();
  const state = initialGameState(scenario);
  const inAndalucia = Object.values(state.units).find((entry) => entry.factionId === republic && entry.territoryId === "andalucia")!;

  it("is contested only with a scenario under the provinces module", () => {
    const session = planning(state);
    expect(inContestedGround(scenario, session, inAndalucia)).toBe(true);
    expect(inContestedGround(undefined, session, inAndalucia)).toBe(false);
    expect(inContestedGround(spainM2(), session, inAndalucia)).toBe(false);
    expect(inContestedGround(scenario, session, armyIn(state, "rep-wad-ras-1"))).toBe(false);
  });

  it("offers withdraw routes only for a selection in a territory", () => {
    expect(selectedWithdrawRoutes(scenario, planning(state))).toEqual([]);
    expect(selectedWithdrawRoutes(scenario, planning(state, { orders: [], selectedTerritoryId: territory("andalucia"), selectedUnitIds: [] }))).toEqual([]);
    const selected = planning(state, { orders: [], selectedTerritoryId: territory("andalucia"), selectedUnitIds: [inAndalucia.id] });
    expect(withdrawDestinations(scenario, selected)).toContain("murcia");
  });

  it("greys out Replenish only where the scenario recruits", () => {
    expect(blockedOrders(scenario).map((entry) => entry.label)).toEqual(["Move, Entrench, Rest", "Replenish"]);
    const noRecruiting: Scenario = { ...scenario, rules: { ...scenario.rules, recruitment: "none" } };
    expect(blockedOrders(noRecruiting)).toEqual([{ label: "Move, Entrench, Rest", reason: "Not in contested ground: units here attack or withdraw." }]);
  });

  it("sees another faction's army in a territory", () => {
    expect(enemyPresent(planning(state), territory("andalucia"))).toBe(true);
    expect(enemyPresent(planning(state), territory("madrid"))).toBe(false);
  });
});
