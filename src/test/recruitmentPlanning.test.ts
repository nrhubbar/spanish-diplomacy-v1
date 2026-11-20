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
  type PlanningSession
} from "../main/state/planning";
import { emptyDraft } from "../main/state/session";
import { faction, spain, spainId, territory } from "./support";

const scenario = spain();
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
    session = setRecruitQuantity(scenario, session, catalunya, type("militia-column"), 2);
    expect(session.draft.feedback).toMatch(/At most 3/u);
    session = setRecruitQuantity(scenario, session, catalunya, type("militia-column"), 1);
    expect(basketCost(scenario, session)).toEqual({ funds: 14, manpower: 5 });
    expect(balanceAfterBasket(scenario, session)).toEqual({ funds: 26, manpower: 5 });
    session = setRecruitQuantity(scenario, session, catalunya, type("infantry-regiment"), 0);
    expect(draftOrders(session.draft)).toHaveLength(1);
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

    const moving = chooseDestination(scenario, chooseOrder(scenario, { ...session, draft: { ...session.draft, selectedUnitIds: [unitHere.id] } }, "move"), territory("aragon"));
    expect(moving.draft.replenishments).toEqual([]);
    expect(orderOf(moving, worn.units[unitHere.id]!)).toBe("move");
  });

  it("describes men, cost, arrival and the cancel rule", () => {
    expect(replenishDetail(scenario, worn, [worn.units[unitHere.id]!])).toMatch(/^\+\d+ men, arriving at the end of the turn · .*Funds.* · cancelled and refunded if the unit fights$/u);
  });
});

describe("wording", () => {
  it("labels resources, men and training", () => {
    expect(resourcesLabel(scenario, { funds: 6, manpower: 1 } as Resources)).toBe("6 Funds and 1 Manpower");
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
      { factionId: republic, kind: "recruit", territoryId: catalunya, unitTypeId: type("tank-company") }
    ] }], 2);
    const lines = result.outcomes.filter((outcome) => outcome.kind.startsWith("training")).map((outcome) => describeOutcome(scenario, outcome));
    expect(lines).toContain("Militia column No. 1 finished training in Cataluña. It can move next turn.");
    expect(lines.some((line) => line.startsWith("Tank company No. 1 began training in Cataluña for 12 Funds and 1 Manpower; ready in 4 turns."))).toBe(true);
    expect(lines.some((line) => line.includes("was not raised"))).toBe(true);
  });
});
