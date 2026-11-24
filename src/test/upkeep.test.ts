import { describe, expect, it } from "vitest";
import { planBuilds } from "../main/ai/orders/build";
import { planDisbands } from "../main/ai/orders/disband";
import { planRecruits } from "../main/ai/orders/recruit";
import { planReplenishment } from "../main/ai/orders/replenish";
import type { PlanningContext } from "../main/ai/orders/planner";
import { turnCasualties } from "../main/engine/casualties";
import { requireUnitDefinition } from "../main/engine/lookup";
import { holdings } from "../main/engine/carry";
import { chargeUpkeep, menLeaving, projectedHoldings, upkeepBill, upkeepLines, upkeepProblem, upkeepShortfall } from "../main/engine/economy/upkeep";
import { startDraft } from "../main/engine/phases/draft";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type { FactionId, GameState, Order, ResourceId, Scenario, TerritoryId, TrainingItem, TurnOutcome, UnitState, UnitTypeDefinition, UnitTypeId } from "../main/engine/types";
import { validateOrder } from "../main/engine/validation";
import { isPublicOrder, ordersFor, outcomesFor } from "../main/engine/visibility";
import { describeSystemOutcome } from "../main/presentation/systemText";
import { faction, spainWithAir } from "./support";
import { pinned } from "./pinned";

/** D1: upkeep, shortage and Disband. */

const scenario = pinned(spainWithAir());
const republic = faction("republic");
const north = faction("north");
const manpower = "manpower" as ResourceId;
const initial = initialGameState(scenario);
const typeOf = (id: string): UnitTypeDefinition => scenario.index.unitTypes.get(id as UnitTypeId)!;
const own = (state: GameState, type?: string): UnitState[] => Object.values(state.units)
  .filter((unit) => unit.factionId === republic && (type === undefined || scenario.index.units.get(unit.id)?.type === type));
const withStock = (points: number, state: GameState = initial): GameState => ({ ...state, treasuries: { ...state.treasuries, [republic]: { ...state.treasuries[republic], [manpower]: points } } });
/** No income: nobody holds a sub-territory. */
const broke = (points = 0): GameState => ({ ...withStock(points), subTerritories: {} });
const militia: TerritoryId = "madrid" as TerritoryId;
const recruit = (type: string, factionId: FactionId = republic): Order => ({ factionId, kind: "recruit", territoryId: militia, unitTypeId: type as UnitTypeId });
const disband = (unit: UnitState): Order => ({ factionId: unit.factionId, kind: "disband", unitId: unit.id });
const training = (patch: Partial<TrainingItem>): TrainingItem => ({ factionId: republic, paid: {}, paused: false, territoryId: militia, turnsLeft: 1, typeId: "militia-column" as UnitTypeId, unitId: "t_x" as never, ...patch });
const billOf = (state: GameState, planned: readonly Order[] = []): number => upkeepBill(upkeepLines(scenario, state, republic, planned))[manpower] ?? 0;
const ofKind = <K extends TurnOutcome["kind"]>(outcomes: readonly TurnOutcome[], kind: K) => outcomes.filter((entry): entry is Extract<TurnOutcome, { kind: K }> => entry.kind === kind);
const rich: GameState = { ...initial, treasuries: { ...initial.treasuries, [republic]: { ["funds" as ResourceId]: 80, [manpower]: 80 } } };
/** A hundred columns finishing training this turn: far more upkeep than the stock covers. */
const drafted = (state: GameState): GameState => ({ ...state, training: Array.from({ length: 100 }, () => training({})) });
const context = (state: GameState, planned: readonly Order[] = []): PlanningContext => ({ factionId: republic, memory: undefined, planned, random: () => 0.5, scenario, state }) as never;
const charge = (state: GameState, at: Scenario = scenario) => chargeUpkeep(startDraft({ dice: undefined as never, scenario: at, seed: 1, start: state, streams: undefined as never, submissions: [] }));

describe("the bill", () => {
  it("counts every unit on the map at any strength, not generals", () => {
    const expected = own(initial).reduce((sum, unit) => sum + Math.round(1000 * (typeOf(scenario.index.units.get(unit.id)?.type ?? "general").upkeep[manpower] ?? 0)), 0);
    expect(billOf(initial)).toBe(expected);
    const [first] = own(initial, "militia-column");
    expect(billOf({ ...initial, units: { ...initial.units, [first!.id]: { ...first!, strength: 1 } } })).toBe(expected);
    expect(typeOf("general").upkeep).toEqual({});
  });

  it("leaves out planned Disbands and adds units finishing training, one-turn recruits included", () => {
    const [first] = own(initial, "militia-column");
    expect(billOf(initial, [disband(first!)])).toBe(billOf(initial) - 1500);
    expect(billOf(initial, [recruit("militia-column"), recruit("infantry-regiment")])).toBe(billOf(initial) + 1500);
    expect(billOf({ ...initial, training: [training({}), training({ turnsLeft: 2 }), training({ factionId: north })] })).toBe(billOf(initial) + 1500);
  });

  it("waits for a unit paused in contested ground, unless its type trains on there", () => {
    const [capital] = scenario.index.subTerritoriesByTerritory.get(militia)!;
    const contested: GameState = { ...initial, subTerritories: { ...initial.subTerritories, [capital!.id]: { ...initial.subTerritories[capital!.id]!, holder: north } } };
    expect(billOf({ ...contested, training: [training({ typeId: "infantry-regiment" as UnitTypeId })] })).toBe(billOf(contested));
    expect(billOf({ ...contested, training: [training({})] })).toBe(billOf(contested) + 1500);
  });
});

describe("the projection", () => {
  it("is what a quiet turn really leaves", () => {
    const planned = [recruit("militia-column")];
    const state = withStock(40);
    const result = resolveTurn(scenario, state, [{ factionId: republic, orders: planned }], 3);
    expect(holdings(result.finalState, republic)[manpower]).toBe(projectedHoldings(scenario, state, republic, planned)[manpower]);
    expect(ofKind(result.outcomes, "upkeep").find((entry) => entry.factionId === republic)).toMatchObject({ left: [], short: {} });
  });

  it("counts builds, Replenish and its unknown units, and a shortage only of what upkeep takes", () => {
    const [unit] = own(initial, "infantry-regiment");
    const worn: GameState = { ...initial, units: { ...initial.units, [unit!.id]: { ...unit!, strength: 100 } } };
    const at = (order: Order): number => projectedHoldings(scenario, worn, republic, [order])[manpower]!;
    const base = projectedHoldings(scenario, worn, republic, [])[manpower]!;
    expect(at({ factionId: republic, kind: "replenish", unitId: unit!.id })).toBeLessThan(base);
    expect(at({ factionId: republic, kind: "replenish", unitId: "nobody" as never })).toBe(base);
    expect(at({ factionId: republic, kind: "build", project: { buildingId: "nothing" as never, kind: "building" }, subTerritoryId: "madrid" as never })).toBe(base);
    const debt: GameState = { ...withStock(400), treasuries: { [republic]: { ["funds" as ResourceId]: -99, [manpower]: 400 } } };
    expect(upkeepShortfall(scenario, debt, republic, [])).toEqual({});
    const free: Scenario = Object.fromEntries(Object.entries(scenario).filter(([key]) => key !== "upkeep")) as unknown as Scenario;
    expect(upkeepShortfall(free, broke(), republic, [])).toEqual({});
    expect(upkeepLines(free, broke(), republic, [])).toEqual([]);
    expect(charge(broke(), free).events).toEqual([]);
  });
});

describe("refusals at reveal", () => {
  const submit = (state: GameState, orders: readonly Order[]) => resolveTurn(scenario, state, [{ factionId: republic, orders }], 5);

  it("refuses a Recruit that leaves the stock short, and all while it is short", () => {
    const once = [recruit("militia-column")];
    const state: GameState = { ...rich, carry: { [republic]: { [manpower]: projectedHoldings(scenario, rich, republic, once)[manpower]! } } };
    expect(ofKind(submit(state, once).outcomes, "training-started")).toHaveLength(1);
    const { outcomes } = submit(drafted(rich), once);
    expect(ofKind(outcomes, "training-refunded")[0]?.reason).toBe("Next turn's upkeep would leave you short of Manpower.");
    expect(ofKind(outcomes, "training-started")).toEqual([]);
    expect(upkeepProblem(scenario, broke(), republic, [])).toContain("Manpower");
  });

  it("lets a Disband in the same turn make room, and refuses a Replenish like a Recruit", () => {
    const [unit] = own(initial, "infantry-regiment").filter((entry) => initial.control[entry.territoryId]?.kind === "controlled");
    const short = broke(1);
    const worn: GameState = { ...withStock(1), units: { ...initial.units, [unit!.id]: { ...unit!, strength: 200 } } };
    const replenish: Order = { factionId: republic, kind: "replenish", unitId: unit!.id };
    expect(upkeepProblem(scenario, short, republic, own(short).map(disband))).toBeUndefined();
    const all = submit(withStock(3), [...own(initial, "militia-column").map(disband), ...own(initial, "security-forces").map(disband), recruit("militia-column")]);
    expect(ofKind(all.outcomes, "training-started")).toHaveLength(1);
    const refused = submit(drafted({ ...worn, treasuries: rich.treasuries }), [replenish]);
    expect(ofKind(refused.outcomes, "replenish-cancelled")[0]).toMatchObject({ reason: "Next turn's upkeep would leave you short of Manpower.", refund: {} });
  });
});

describe("a shortage", () => {
  const rules = scenario.upkeep!;

  it("takes the stock to 0 and sends men home in proportion, capped at a tenth and half of full strength", () => {
    const state = broke(1);
    const draft = charge(state);
    const event = ofKind(draft.events, "upkeep").find((entry) => entry.factionId === republic)!;
    expect(draft.systems.treasuries[republic]?.[manpower]).toBe(0);
    expect(draft.systems.carry?.[republic]?.[manpower]).toBeUndefined();
    expect(event.short[manpower]).toBe(event.due[manpower]! - 1);
    expect(event.left.length).toBeGreaterThan(0);
    for (const { men, unitId } of event.left) {
      const full = scenario.index.units.get(unitId)!.fullStrength;
      expect(men).toBeLessThanOrEqual(full / 10);
      expect(draft.armies[unitId]!.strength).toBe(state.units[unitId]!.strength - men);
      expect(draft.armies[unitId]!.strength).toBeGreaterThanOrEqual(full / 2);
    }
    expect(turnCasualties(scenario, state, [event]).size).toBe(0);
    expect(outcomesFor(scenario, state, [event], north)).toEqual([]);
    expect(outcomesFor(scenario, state, [event], republic)).toEqual([event]);
    const text = (entry: typeof event): string => describeSystemOutcome(entry, { scenario, state, viewer: republic });
    expect(text(event)).toMatch(/could not be paid, and \d+ men left their units\.$/u);
    expect(text({ ...event, left: [] })).toContain("no more men could leave");
    expect(text({ ...event, short: {} })).toMatch(/in upkeep\.$/u);
  });

  it("rounds to the exact total, ties by id, and passes nothing on from a capped unit", () => {
    const three = own(initial, "infantry-regiment").slice(0, 3).map((unit) => ({ ...unit, strength: scenario.index.units.get(unit.id)!.fullStrength }));
    const left = menLeaving(scenario, {}, rules, three, manpower, 10);
    expect(left.reduce((sum, entry) => sum + entry.men, 0)).toBe(10);
    expect(menLeaving(scenario, {}, rules, [...three].reverse(), manpower, 10)).toEqual(left);
    expect(menLeaving(scenario, {}, rules, three, manpower, 1_000_000).every(({ men, unitId }) => men === Math.floor(scenario.index.units.get(unitId)!.fullStrength / 10))).toBe(true);
    const low = { ...three[0]!, strength: Math.ceil(scenario.index.units.get(three[0]!.id)!.fullStrength / 2) };
    expect(menLeaving(scenario, {}, rules, [low], manpower, 100)).toEqual([]);
    expect(menLeaving(scenario, {}, rules, [], manpower, 100)).toEqual([]);
    expect(menLeaving(scenario, {}, rules, three, "funds" as ResourceId, 9000)).toEqual([]);
  });

  it("leaves an older debt in the carry, and charges nobody without a treasury", () => {
    const owing: GameState = { ...broke(0), carry: { [republic]: { [manpower]: 900 } } };
    const draft = charge(owing);
    expect(draft.systems.carry?.[republic]?.[manpower]).toBe(900);
    expect(charge({ ...owing, treasuries: {} }).events).toEqual([]);
  });
});

describe("Disband", () => {
  const [unit] = own(initial, "militia-column");

  it("resolves before income, gives nothing back, is no casualty, and shows once resolved", () => {
    const result = resolveTurn(scenario, withStock(40), [{ factionId: republic, orders: [disband(unit!)] }], 3);
    expect(result.finalState.units[unit!.id]).toBeUndefined();
    const [event] = ofKind(result.outcomes, "unit-disbanded");
    expect(turnCasualties(scenario, initial, [event!]).size).toBe(0);
    expect(outcomesFor(scenario, result.finalState, [event!], north)).toEqual([event]);
    expect(describeSystemOutcome(event!, { scenario, state: result.finalState, viewer: north })).toContain("was disbanded in");
    expect(holdings(result.finalState, republic)[manpower]).toBe(projectedHoldings(scenario, withStock(40), republic, [disband(unit!)])[manpower]);
  });

  it("stays its owner's until then, and a unit already lost has nothing to disband", () => {
    expect(isPublicOrder(disband(unit!))).toBe(false);
    expect(ordersFor(scenario, initial, [disband(unit!)], north)).toEqual([]);
    expect(ordersFor(scenario, initial, [disband(unit!)], republic)).toHaveLength(1);
    const units = Object.fromEntries(Object.entries(initial.units).filter(([id]) => id !== unit!.id));
    expect(ofKind(resolveTurn(scenario, { ...initial, units }, [{ factionId: republic, orders: [disband(unit!)] }], 3).outcomes, "unit-disbanded")).toEqual([]);
  });

  it("is for a side's own ground units and aircraft, anywhere, not generals", () => {
    const check = (order: Order): string | undefined => { const verdict = validateOrder(scenario, initial, order); return verdict.ok ? undefined : verdict.reason; };
    const general = Object.values(initial.units).find((entry) => entry.factionId === republic && requireUnitDefinition(scenario, entry.id).type === "general")!;
    const aircraft = own(initial).find((entry) => typeOf(scenario.index.units.get(entry.id)?.type ?? "general").kind === "air")!;
    expect(check(disband(unit!))).toBeUndefined();
    expect(check(disband(aircraft))).toBeUndefined();
    expect(check(disband(general))).toBe("General units cannot disband.");
    expect(check({ ...disband(unit!), factionId: north })).toBe("Selected unit belongs to another player.");
    expect(check({ factionId: republic, kind: "disband", unitId: "nobody" as never })).toBe("Unknown unit.");
    expect(validateOrder({ ...scenario, rules: { ...scenario.rules, recruitment: "none" } }, initial, disband(unit!)).ok).toBe(false);
  });
});

describe("the computer player", () => {
  it("disbands the least fighting value per upkeep it can spare until the stock covers the bill", () => {
    const orders = planDisbands(context(broke(0)));
    expect(scenario.index.units.get(orders[0]!.unitId)?.type).toBe("militia-column");
    const needs = withStock(Math.max(0, Math.ceil(-projectedHoldings(scenario, withStock(0), republic, [])[manpower]! / 1000)));
    expect(planDisbands(context(needs))).toEqual([]);
    const oneShort = { ...needs, carry: { [republic]: { [manpower]: 1000 + projectedHoldings(scenario, needs, republic, [])[manpower]! } } };
    const fixed = planDisbands(context(oneShort));
    expect(fixed).toHaveLength(1);
    expect(upkeepShortfall(scenario, oneShort, republic, fixed)).toEqual({});
  });

  it("keeps units with orders, and the last fighting unit next to a rival", () => {
    const ordered = own(initial).map((entry): Order => ({ factionId: republic, kind: "replenish", unitId: entry.id }));
    expect(planDisbands(context(broke(0), ordered))).toEqual([]);
    const gone = new Set(planDisbands(context(broke(0))).map((order) => order.unitId));
    const guarded = new Set(own(initial).filter((entry) => typeOf(scenario.index.units.get(entry.id)?.type ?? "general").defence > 0).map((entry) => entry.territoryId));
    for (const id of guarded) {
      const front = (scenario.index.neighbors.get(id) ?? []).some((next) => { const held = initial.control[next.territoryId]; return held !== undefined && (held.kind !== "controlled" || held.factionId !== republic); });
      if (front) expect(own(initial).some((entry) => entry.territoryId === id && !gone.has(entry.id))).toBe(true);
    }
  });

  it("never recruits or replenishes into a shortage", () => {
    const worn = (state: GameState): GameState => ({ ...state, units: Object.fromEntries(Object.entries(state.units).map(([id, entry]) => [id, { ...entry, strength: Math.ceil(entry.strength / 2) }])) });
    expect(planRecruits(context(rich)).length).toBeGreaterThan(0);
    expect(planReplenishment(context(worn(rich))).length).toBeGreaterThan(0);
    expect(planRecruits(context(drafted(rich)))).toEqual([]);
    expect(planReplenishment(context(worn(drafted(rich))))).toEqual([]);
  });
});

describe("the computer player's builds", () => {
  /** Every project also costs one point of Manpower. */
  const priced = <T extends { readonly cost: Record<string, number> }>(entry: T): T => ({ ...entry, cost: { ...entry.cost, [manpower]: 1 } });
  const dear: Scenario = {
    ...scenario,
    index: {
      ...scenario.index,
      buildings: new Map([...scenario.index.buildings].map(([id, building]) => [id, priced(building)])),
      development: new Map([...scenario.index.development].map(([id, track]) => [id, { ...track, upgrade: priced(track.upgrade) }]))
    }
  };
  /** Next turn's stock covers the upkeep exactly, with a stock of 80 to pay from. */
  const exact: GameState = { ...rich, carry: { [republic]: { [manpower]: projectedHoldings(dear, rich, republic, [])[manpower] ?? 0 } } };

  it("never leaves next turn's stock further short of the upkeep, and goes on while what it costs is not short", () => {
    expect(planBuilds({ ...context(rich), scenario: dear }).length).toBeGreaterThan(0);
    expect(planBuilds({ ...context(exact), scenario: dear })).toEqual([]);
    // Already short: a build that costs no Manpower changes nothing, so it is still planned.
    expect(planBuilds(context({ ...rich, carry: { [republic]: { [manpower]: 200_000 } } })).length).toBeGreaterThan(0);
  });
});
