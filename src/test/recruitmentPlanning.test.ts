import { describe, expect, it } from "vitest";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type { GameState, Resources, UnitTypeId } from "../main/engine/types";
import { validateSubmission } from "../main/engine/validation";
import { describeOutcome } from "../main/presentation/text";
import { menShort, replenishDetail, resourcesLabel, trainingStatus } from "../main/presentation/recruitment";
import {
  balanceAfterBasket,
  basketCost,
  chooseDestination,
  chooseOrder,
  draftOrders,
  orderCounts,
  orderKindsFor,
  orderOf,
  recruitQuantity,
  selectTerritory,
  setRecruitQuantity,
  takeBackRecruit,
  type PlanningSession
} from "../main/state/planning";
import { emptyDraft } from "../main/state/session";
import { faction, spain, spainId, territory } from "./support";
import { pinned } from "./pinned";

const scenario = pinned(spain());
const republic = faction("republic");
const type = (id: string): UnitTypeId => id as UnitTypeId;
const catalunya = territory("catalunya");

function planning(state: GameState = initialGameState(scenario)): PlanningSession {
  return {
    draft: emptyDraft,
    factionId: republic,
    game: { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state },
    phase: "planning"
  };
}

describe("the Recruit basket (X4)", () => {
  it("sets quantities within the D7 limit and totals the cost and what is left", () => {
    let session = setRecruitQuantity(scenario, planning(), catalunya, type("infantry-regiment"), 2);
    expect(recruitQuantity(session.draft, catalunya, type("infantry-regiment"))).toBe(2);
    session = setRecruitQuantity(scenario, session, catalunya, type("militia-column"), 3);
    expect(session.draft.feedback).toMatch(/At most 4/u);
    session = setRecruitQuantity(scenario, session, catalunya, type("militia-column"), 1);
    expect(basketCost(scenario, session)).toEqual({ funds: 14, manpower: 5 });
    expect(balanceAfterBasket(scenario, session)).toEqual({ funds: 26, manpower: 5 });
    session = setRecruitQuantity(scenario, session, catalunya, type("infantry-regiment"), 0);
    expect(draftOrders(session.draft)).toHaveLength(1);
  });

  it("keeps every other order's place, and takes one back by its place", () => {
    const ordered = (session: PlanningSession) => (session.draft.recruits ?? []).map((order) => order.unitTypeId);
    let session = setRecruitQuantity(scenario, planning(), catalunya, type("infantry-regiment"), 1);
    session = setRecruitQuantity(scenario, session, catalunya, type("militia-column"), 1);
    session = setRecruitQuantity(scenario, session, catalunya, type("infantry-regiment"), 2);
    expect(ordered(session)).toEqual(["infantry-regiment", "militia-column", "infantry-regiment"]);
    expect(ordered(setRecruitQuantity(scenario, session, catalunya, type("infantry-regiment"), 1))).toEqual(["infantry-regiment", "militia-column"]);
    expect(ordered(takeBackRecruit(session, catalunya, 0))).toEqual(["militia-column", "infantry-regiment"]);
    const refused = setRecruitQuantity(scenario, session, catalunya, type("colonial-veterans"), 1);
    expect(refused.draft.feedback).toBeDefined();
    expect(takeBackRecruit(refused, catalunya, 1).draft.feedback).toBeUndefined();
    expect(takeBackRecruit(session, catalunya, 3)).toBe(session);
    expect(takeBackRecruit(planning(), catalunya, 0).draft.recruits).toBeUndefined();
  });

  it("refuses locked types and sites with the engine's reason, and keeps the basket across selection", () => {
    expect(setRecruitQuantity(scenario, planning(), catalunya, type("colonial-veterans"), 1).draft.feedback).toMatch(/Not raised/u);
    expect(setRecruitQuantity(scenario, planning(), territory("asturias"), type("militia-column"), 1).draft.feedback).toMatch(/contested/u);
    const session = selectTerritory(setRecruitQuantity(scenario, planning(), catalunya, type("militia-column"), 1), territory("madrid"));
    expect(session.draft.recruits).toHaveLength(1);
  });
});

describe("the Replenish order (X7, R5)", () => {
  const base = initialGameState(scenario);
  const unitHere = Object.values(base.units).find((entry) => entry.factionId === republic && entry.territoryId === "catalunya")!;
  const worn: GameState = { ...base, units: { ...base.units, [unitHere.id]: { ...unitHere, strength: Math.round(unitHere.strength / 2) } } };

  it("is offered first when every selected unit can replenish, and replaces a move", () => {
    let session = selectTerritory(planning(worn), catalunya);
    session = { ...session, draft: { ...session.draft, selectedUnitIds: [unitHere.id] } };
    expect(orderKindsFor(session, scenario)[0]).toBe("replenish");
    expect(orderKindsFor(selectTerritory(planning(), catalunya), scenario)).not.toContain("replenish");
    session = chooseOrder(scenario, session, "replenish");
    expect(orderOf(session, worn.units[unitHere.id]!)).toBe("replenish");
    expect(orderCounts(session).replenish).toBe(1);
    expect(validateSubmission(scenario, worn, republic, { factionId: republic, orders: draftOrders(session.draft) }).ok).toBe(true);

    // The replenishing unit leaves the default selection, so an order for the rest keeps its Replenish.
    expect(session.draft.selectedUnitIds).not.toContain(unitHere.id);
    const others = selectTerritory(session, catalunya);
    expect(others.draft.selectedUnitIds).not.toContain(unitHere.id);
    const rest = chooseOrder(scenario, others, "entrench");
    expect(rest.draft.replenishments?.map((order) => order.unitId)).toEqual([unitHere.id]);

    const moving = chooseDestination(scenario, chooseOrder(scenario, { ...session, draft: { ...session.draft, selectedUnitIds: [unitHere.id] } }, "move"), territory("aragon"));
    expect(moving.draft.replenishments).toEqual([]);
    expect(orderOf(moving, worn.units[unitHere.id]!)).toBe("move");
  });

  it("is refused when the rest of the draft leaves too little to pay for it (m11)", () => {
    const poor: GameState = { ...worn, treasuries: { ...worn.treasuries, [republic]: { funds: 0, manpower: 0 } as Resources } };
    let session = selectTerritory(planning(poor), catalunya);
    session = chooseOrder(scenario, { ...session, draft: { ...session.draft, selectedUnitIds: [unitHere.id] } }, "replenish");
    expect(session.draft.replenishments ?? []).toEqual([]);
    expect(session.draft.feedback).toMatch(/Not enough/u);
    // With money, the same order is taken and counts in the basket.
    let rich = selectTerritory(planning(worn), catalunya);
    rich = chooseOrder(scenario, { ...rich, draft: { ...rich.draft, selectedUnitIds: [unitHere.id] } }, "replenish");
    expect(rich.draft.replenishments).toHaveLength(1);
    expect(Object.values(basketCost(scenario, rich)).some((value) => value > 0)).toBe(true);
  });

  it("describes men, cost, arrival and the cancel rule", () => {
    expect(replenishDetail(scenario, worn, [worn.units[unitHere.id]!])).toMatch(/^\+\d+ men, arriving at the end of the turn \u00b7 .*Funds.* \u00b7 cancelled and refunded if the unit fights$/u);
  });
});

describe("wording", () => {
  it("labels resources, men and training", () => {
    expect(resourcesLabel(scenario, { funds: 6, manpower: 1 } as Resources)).toBe("6 Funds and 1k Manpower");
    expect(resourcesLabel(scenario, {})).toBe("nothing");
    expect(menShort(2500)).toBe("2.5k men");
    expect(menShort(700)).toBe("700 men");
    const item = { factionId: republic, paid: {}, paused: false, territoryId: catalunya, turnsLeft: 2, typeId: type("militia-column"), unitId: "x" as never };
    expect(trainingStatus(item)).toBe("Ready in 2 turns");
    expect(trainingStatus({ ...item, turnsLeft: 1 })).toBe("Ready at the end of this turn");
    expect(trainingStatus({ ...item, paused: true })).toMatch(/Paused/u);
  });

  it("reports every recruitment outcome in full sentences", () => {
    const state = { ...initialGameState(scenario), treasuries: { [republic]: { funds: 30, manpower: 10 } } };
    const result = resolveTurn(scenario, state, [{ factionId: republic, orders: [
      { factionId: republic, kind: "recruit", territoryId: catalunya, unitTypeId: type("militia-column") },
      { factionId: republic, kind: "recruit", territoryId: catalunya, unitTypeId: type("tank-company") },
      { factionId: republic, kind: "recruit", territoryId: catalunya, unitTypeId: type("tank-company") },
      { factionId: republic, kind: "recruit", territoryId: catalunya, unitTypeId: type("tank-company") },
      { factionId: republic, kind: "recruit", territoryId: catalunya, unitTypeId: type("tank-company") }
    ] }], 2);
    const lines = result.outcomes.filter((outcome) => outcome.kind.startsWith("training")).map((outcome) => describeOutcome(scenario, outcome));
    expect(lines).toContain("Militia column No. 1 finished training at Barcelona. It can move next turn.");
    expect(lines.some((line) => line.startsWith("Tank company (new) began training at Barcelona for 10 Funds and 1k Manpower; ready in 3 turns."))).toBe(true);
    expect(lines.some((line) => line.includes("was not raised"))).toBe(true);
  });
});
