import { describe, expect, it } from "vitest";
import { inPoints, inThousandths } from "../../main/engine/carry";
import { projectedHoldings } from "../../main/engine/economy/upkeep";
import { initialGameState } from "../../main/engine/resolution";
import type { GameState, ResourceId, Scenario, TerritoryId, TrainingItem, UnitId, UnitState, UnitTypeId } from "../../main/engine/types";
import { ledgersFor } from "../../main/presentation/ledger";
import { disbandSaving, shortageWarning } from "../../main/presentation/recruitment";
import { unitName } from "../../main/presentation/text";
import { groupThisTurn, thisTurnEntries } from "../../main/presentation/thisTurn";
import {
  armiesWithoutOrders, availableUnitIds, canDisband, chooseOrder, chooseReplenish, draftOrders, isDisbandPlanned, orderCounts, orderKindsFor, orderMuster, orderOf,
  disbandableSelection, planDisband, plannedShortfall, type PlanningSession, recruitUpkeepProblem, removeOrder, replenishPlan, setAirMission, setRecruitQuantity, unitOrdersWithout
} from "../../main/state/planning";
import { type Draft, emptyDraft } from "../../main/state/session";
import { submitOnTimeout } from "../../main/state/timeout";
import { faction, spainWithAir } from "../support";

/** D1: Disband, the upkeep refusals and the Upkeep row on the planning screen. */

const scenario = spainWithAir();
const noUpkeep: Scenario = { ...scenario };
delete (noUpkeep as { upkeep?: unknown }).upkeep;
const republic = faction("republic");
const manpower = "manpower" as ResourceId;
const madrid = "madrid" as TerritoryId;
const militiaType = "militia-column" as UnitTypeId;
const initial = initialGameState(scenario);
const typeIdOf = (unit: UnitState): string => scenario.index.units.get(unit.id)?.type ?? "";
const kindOf = (unit: UnitState): string => scenario.index.unitTypes.get(typeIdOf(unit) as UnitTypeId)?.kind ?? "";
const own = (kind: string): UnitState[] => Object.values(initial.units).filter((unit) => unit.factionId === republic && kindOf(unit) === kind);
const inMadrid = own("ground").filter((unit) => unit.territoryId === madrid);
const [first, second] = inMadrid as [UnitState, UnitState];
const plane = own("air")[0]!;
const stock = (funds: number, men: number): GameState => ({ ...initial, treasuries: { ...initial.treasuries, [republic]: { ["funds" as ResourceId]: funds, [manpower]: men } } });
const planning = (state: GameState = stock(80, 80), draft: Draft = emptyDraft): PlanningSession => ({
  draft, factionId: republic, game: { assignments: {}, history: [], locked: {}, scenarioId: scenario.id, seed: 1, state }, phase: "planning"
});
/** Next turn's stock is exactly `points` when nothing is planned. */
const leaving = (points: number): GameState => {
  const base = projectedHoldings(scenario, stock(80, 0), republic, [])[manpower] ?? 0;
  const whole = Math.ceil(points - base / 1000);
  return { ...stock(80, whole), carry: { [republic]: { [manpower]: whole * 1000 + base - points * 1000 } } };
};

describe("planning a Disband (D1)", () => {
  it("is offered for ground units and aircraft, wherever they stand, and not for generals", () => {
    const session = planning();
    expect(canDisband(scenario, session, first)).toBe(true);
    expect(canDisband(scenario, session, plane)).toBe(true);
    const general = Object.values(initial.units).find((unit) => kindOf(unit) === "general")!;
    expect(canDisband(scenario, session, general)).toBe(false);
    const refused = planDisband(scenario, planning(initial, emptyDraft), [Object.values(initial.units).find((unit) => unit.factionId !== republic)!.id]);
    expect(refused.draft.disbands).toBeUndefined();
    expect(refused.draft.feedback).toBe("Selected unit belongs to another player.");
  });

  it("is an order for the whole selection, offered last while one of them is not going yet (N1)", () => {
    const general = Object.values(initial.units).find((unit) => unit.factionId === republic && kindOf(unit) === "general")!;
    const select = (...units: readonly UnitState[]): PlanningSession => planning(undefined, { ...emptyDraft, selectedTerritoryId: madrid, selectedUnitIds: units.map(({ id }) => id) });
    expect(orderKindsFor(select(first, second), scenario).at(-1)).toBe("disband");
    expect(orderKindsFor(select(general), scenario)).not.toContain("disband");
    // Selecting a territory selects its general too: he stays, and only he.
    expect(orderKindsFor(select(first, general), scenario)).toContain("disband");
    expect(disbandableSelection(scenario, select(first, general))).toEqual([first.id]);
    const withGeneral = chooseOrder(scenario, select(first, general), "disband");
    expect(withGeneral.draft.disbands?.map(({ unitId }) => unitId)).toEqual([first.id]);
    expect(withGeneral.draft.selectedUnitIds).toEqual([]);
    expect(orderKindsFor(select(first, second))).not.toContain("disband");
    const ordered = chooseOrder(scenario, select(first, second), "disband");
    expect(ordered.draft.disbands?.map(({ unitId }) => unitId)).toEqual([first.id, second.id]);
    expect(ordered.draft.selectedUnitIds).toEqual([]);
    expect(ordered.draft.feedback).toBe(`${unitName(scenario, first.id)} and ${unitName(scenario, second.id)} will disband at the end of the turn.`);
    const again = { ...ordered, draft: { ...ordered.draft, selectedUnitIds: [first.id] } };
    expect(orderKindsFor(again, scenario)).not.toContain("disband");
    expect(orderKindsFor({ ...again, draft: { ...again.draft, selectedUnitIds: [first.id, inMadrid[2]!.id] } }, scenario)).toContain("disband");
    // Taken back one by one, and refused as a whole when one of them can't.
    expect(removeOrder(ordered, first.id).draft.disbands?.map(({ unitId }) => unitId)).toEqual([second.id]);
    const refused = planDisband(scenario, select(first, general), [first.id, general.id]);
    expect(refused.draft.disbands).toBeUndefined();
    expect(refused.draft.feedback).toBe("General units cannot disband.");
  });

  it("replaces the unit's other order, leaves the selection and closes a destination choice", () => {
    const session = planning(undefined, {
      ...emptyDraft, orderedToStay: [first.id, second.id], selectedTerritoryId: madrid, selectedUnitIds: [first.id, second.id], stage: { orderKind: "move", step: "choose-destination" },
      orders: [{ factionId: republic, from: madrid, kind: "move", to: "valencia" as TerritoryId, unitId: first.id }],
      replenishments: [{ factionId: republic, kind: "replenish", unitId: first.id }]
    });
    const { draft } = planDisband(scenario, session, [first.id]);
    expect(draft.orders).toEqual([]);
    expect(draft.replenishments).toEqual([]);
    expect(draft.orderedToStay).toEqual([second.id]);
    expect(draft.selectedUnitIds).toEqual([second.id]);
    expect(draft.stage).toBeUndefined();
    expect(draft.disbands).toEqual([{ factionId: republic, kind: "disband", unitId: first.id }]);
    expect(draft.feedback).toContain("will disband at the end of the turn.");
    expect(isDisbandPlanned(draft, first.id)).toBe(true);
    expect(isDisbandPlanned(emptyDraft, first.id)).toBe(false);
  });

  it("counts as the unit's order, and clearing it brings back the standing order", () => {
    const session = planDisband(scenario, planning(), [first.id]);
    expect(orderOf(session, first, scenario)).toBe("disband");
    expect(orderCounts(session, scenario).disband).toBe(1);
    expect(availableUnitIds(session, madrid, [], undefined, scenario)).not.toContain(first.id);
    expect(armiesWithoutOrders(scenario, session).map((unit) => unit.id)).not.toContain(first.id);
    const entries = thisTurnEntries(scenario, { ...session.draft, airOrders: [] }, () => madrid);
    expect(entries.map((entry) => [entry.detail, entry.cancel])).toEqual([["Disband · Madrid", { kind: "order", unitId: first.id }]]);
    expect(groupThisTurn(scenario, entries, "type")[0]?.key).toBe("units");
    const undone = removeOrder(session, first.id);
    expect(undone.draft.disbands).toEqual([]);
    expect(orderOf(undone, first, scenario)).not.toBe("disband");
  });

  it("gives way to any other order the unit takes", () => {
    const ordered = planDisband(scenario, planDisband(scenario, planning(), [first.id]), [plane.id]);
    const selected: PlanningSession = { ...ordered, draft: { ...ordered.draft, selectedTerritoryId: madrid, selectedUnitIds: [first.id] } };
    expect(chooseOrder(scenario, selected, "entrench").draft.disbands).toEqual([{ factionId: republic, kind: "disband", unitId: plane.id }]);
    expect(chooseOrder(scenario, selected, "attack").draft.disbands).toHaveLength(1);
    const worn: GameState = { ...ordered.game.state, units: { ...ordered.game.state.units, [first.id]: { ...first, strength: first.strength - 100 } } };
    const replenished = chooseReplenish(scenario, { ...selected, game: { ...selected.game, state: worn } });
    expect(replenished.draft.replenishments).toHaveLength(1);
    expect(replenished.draft.disbands).toHaveLength(1);
    const target = scenario.index.neighbors.get(madrid)![0]!.territoryId;
    const mustered = orderMuster(scenario, ordered, { kind: "reinforce", moves: [{ unitId: first.id }], shown: [first.id], support: [], target });
    expect(mustered.draft.disbands).toEqual([{ factionId: republic, kind: "disband", unitId: plane.id }]);
    const mission = scenario.index.unitTypes.get(typeIdOf(plane) as UnitTypeId)!.air!.missions[0]!;
    expect(mission).toBeDefined();
    const flying = setAirMission(scenario, ordered, plane.id, { kind: mission, territoryId: plane.territoryId } as never);
    expect(isDisbandPlanned(flying.draft, plane.id)).toBe(flying.draft.airOrders === undefined || flying.draft.airOrders.length === 0);
    const grounded = planDisband(scenario, { ...ordered, draft: { ...emptyDraft, airOrders: [{ factionId: republic, kind: "air-mission", mission: { kind: "patrol", territoryId: madrid }, unitId: plane.id }] } }, [plane.id]);
    expect(grounded.draft.airOrders).toEqual([]);
    expect(unitOrdersWithout(emptyDraft, [first.id])).toEqual({});
  });

  it("is submitted at End Turn and when time runs out", () => {
    const session = planDisband(scenario, planning(), [first.id]);
    expect(draftOrders(session.draft)).toEqual([{ factionId: republic, kind: "disband", unitId: first.id }]);
    const after = submitOnTimeout(scenario, { ...session, game: { ...session.game, assignments: Object.fromEntries(scenario.factions.map(({ id }) => [id, "local-human"])) } as never });
    expect("game" in after ? after.game.locked[republic]?.orders : undefined).toEqual([{ factionId: republic, kind: "disband", unitId: first.id }]);
  });
});

describe("upkeep refusals while planning (D1)", () => {
  const reason = "Next turn's upkeep would leave you short of Manpower.";

  it("refuses a recruit that next turn's stock cannot cover, unless a planned Disband makes room", () => {
    const price = (scenario.index.unitTypes.get(militiaType)!.recruit!.cost[manpower] ?? 0) + (scenario.index.unitTypes.get(militiaType)!.upkeep[manpower] ?? 0);
    const session = planning(leaving(price - 0.1));
    expect(recruitUpkeepProblem(scenario, session, madrid, militiaType)).toBe(reason);
    const refused = setRecruitQuantity(scenario, session, madrid, militiaType, 1);
    expect(refused.draft.recruits).toBeUndefined();
    expect(refused.draft.feedback).toBe(reason);
    const roomy = planDisband(scenario, session, [inMadrid.find((unit) => (scenario.index.unitTypes.get(typeIdOf(unit) as UnitTypeId)!.upkeep[manpower] ?? 0) >= 0.25)!.id]);
    const accepted = setRecruitQuantity(scenario, roomy, madrid, militiaType, 1);
    expect(accepted.draft.recruits).toHaveLength(1);
    // Taking one away is never refused, even while short.
    const short = planning(stock(0, 0), { ...emptyDraft, recruits: accepted.draft.recruits! });
    expect(setRecruitQuantity(scenario, short, madrid, militiaType, 0).draft.recruits).toEqual([]);
  });

  it("skips the units whose Replenish the stock cannot cover, and says so", () => {
    const worn = (state: GameState): GameState => ({ ...state, units: { ...state.units, ...Object.fromEntries([first, second].map((unit) => [unit.id, { ...unit, strength: Math.ceil(unit.strength / 2) }])) } });
    const selected: Draft = { ...emptyDraft, selectedTerritoryId: madrid, selectedUnitIds: [first.id, second.id] };
    expect(replenishPlan(scenario, planning(worn(leaving(40)), selected)).ready).toHaveLength(2);
    // A hundred columns finish training: the stock pays the price, but next turn's does not cover the upkeep.
    const item: TrainingItem = { factionId: republic, paid: {}, paused: false, territoryId: madrid, turnsLeft: 1, typeId: militiaType, unitId: "r_republic_militia-column_9" as UnitId };
    const rich = planning(worn({ ...stock(80, 80), training: Array.from({ length: 100 }, () => item) }), selected);
    const plan = replenishPlan(scenario, rich);
    expect(plan.ready).toEqual([]);
    expect(plan.skipped.map((skip) => skip.reason)).toEqual(["upkeep leaves too little next turn", "upkeep leaves too little next turn"]);
    const refused = chooseReplenish(scenario, rich);
    expect(refused.draft.replenishments).toBeUndefined();
    expect(refused.draft.feedback).toMatch(/^No selected unit can replenish\. Skips /u);
  });

  it("warns of the shortage with the scenario's shares", () => {
    const session = planning(leaving(-4.65));
    const short = plannedShortfall(scenario, session);
    expect(short).toEqual({ [manpower]: 4.65 });
    expect(shortageWarning(scenario, scenario.upkeep!, short)).toEqual({
      body: "Recruiting and Replenish are off. If you change nothing, up to 10% of each unit's men leave (never below half of it). Disband units to save their upkeep.",
      heading: "Manpower will be 4.7k short next turn"
    });
    expect(shortageWarning(scenario, { maxLossShare: 0.2, minStrengthShare: 0.4 }, short)?.body).toContain("up to 20% of each unit's men leave (never below 40% of it)");
    expect(shortageWarning(scenario, scenario.upkeep!, {})).toBeUndefined();
    expect(plannedShortfall(scenario, planning(leaving(0)))).toEqual({});
  });

  it("says what a Disband saves", () => {
    expect(disbandSaving(scenario, [scenario.index.unitTypes.get(militiaType)!])).toBe("Saves 1.5k Manpower a turn");
    expect(disbandSaving(scenario, [{ upkeep: {} }])).toBe("Costs no upkeep");
    expect(disbandSaving(noUpkeep, [scenario.index.unitTypes.get(militiaType)!])).toBe("Costs no upkeep");
  });
});

describe("the Upkeep row (D1)", () => {
  it("lists each type, and now plus next turn is the projection to the thousandth", () => {
    const worn: GameState = { ...stock(80, 80), carry: { [republic]: { [manpower]: 375 } }, units: { ...initial.units, [second.id]: { ...second, strength: second.strength - 100 } } };
    const disbands = [{ factionId: republic, kind: "disband" as const, unitId: first.id }];
    const recruits = [{ factionId: republic, kind: "recruit" as const, territoryId: madrid, unitTypeId: militiaType }];
    const replenishments = [{ factionId: republic, kind: "replenish" as const, unitId: second.id }, { factionId: republic, kind: "replenish" as const, unitId: "gone" as UnitId }];
    const projected = inPoints(projectedHoldings(scenario, worn, republic, [...disbands, ...recruits, ...replenishments]));
    for (const ledger of ledgersFor(scenario, worn, republic, { disbands, recruits, replenishments })) {
      expect(inThousandths({ [ledger.resourceId]: ledger.now + ledger.total })).toEqual(inThousandths({ [ledger.resourceId]: projected[ledger.resourceId] ?? 0 }));
    }
    const ledger = ledgersFor(scenario, worn, republic, { disbands, recruits, replenishments }).find((entry) => entry.resourceId === manpower)!;
    const upkeep = ledger.rows.find((row) => row.key === "upkeep")!;
    expect(upkeep.note).toMatch(/^\d+ units$/u);
    expect(upkeep.lines!.map((line) => line.value)).toEqual([...upkeep.lines!.map((line) => line.value)].sort((a, b) => a - b));
    expect(upkeep.lines!.find((line) => line.key === militiaType)?.label).toMatch(/^Militia column, \d+ at 1\.5k$/u);
    expect(ledger.rows.find((row) => row.key === "carried")?.note).toBe("fractions of a point");
    expect(ledger.rows.find((row) => row.key === "replenish")?.note).toBe("1 unit, planned this turn");
  });

  it("reads \"none\" for a resource no upkeep takes, \"1 unit\" for one, and says so without upkeep", () => {
    const alone: GameState = { ...initial, units: { [first.id]: first } };
    const [funds, men] = ledgersFor(scenario, alone, republic, {});
    expect(funds!.rows.find((row) => row.key === "upkeep")).toMatchObject({ note: "none", value: 0 });
    expect(men!.rows.find((row) => row.key === "upkeep")?.note).toBe("1 unit");
    expect(men!.rows.some((row) => row.key === "carried")).toBe(false);
    expect(ledgersFor(noUpkeep, initial, republic, {})[1]!.rows.find((row) => row.key === "upkeep")?.note).toBe("none in this scenario");
  });
});
