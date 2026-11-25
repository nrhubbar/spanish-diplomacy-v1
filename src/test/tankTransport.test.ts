import { describe, expect, it } from "vitest";
import { legalMoves, withRoutes } from "../main/ai/orders/move";
import { planRecruits } from "../main/ai/orders/recruit";
import { isTransport, isTruck, threatReach, unitRoutes } from "../main/ai/reach";
import { truckBonus } from "../main/engine/movement/allowance";
import { seededRandom } from "../main/engine/random";
import { raisedDefinition, raisedUnitId } from "../main/engine/recruitment/rules";
import { initialGameState } from "../main/engine/resolution";
import type { GameState, Scenario, TerritoryId, UnitId, UnitState, UnitTypeId } from "../main/engine/types";
import { carriesOf, isTruckType } from "../main/engine/units/fighting";
import { armyLeaving } from "../main/presentation/movement";
import { armyIn, faction, spain, territory, unit, withUnits } from "./support";
import { pinned } from "./pinned";
import { holdWhole } from "./air/holdWhole";

/** D2: tanks carry one unit, so they move two on their own, and fight for themselves as trucks cannot. */

const scenario = spain();
const republic = faction("republic");
const madrid = territory("madrid");
const raise = (type: string, serial = 1): UnitId => raisedUnitId(republic, type as UnitTypeId, serial);
const tank = raise("tank-company");
const truck = raise("truck-column");
const foot = unit("rep-wad-ras-1");
const second = unit("rep-covadonga-4");

/** The Republic holds the whole map and no train runs, with the given raised units beside two regiments in Madrid. */
function board(raised: readonly UnitId[], target: Scenario = scenario): GameState {
  let state = withUnits(target, [["rep-wad-ras-1", "republic", "madrid"], ["rep-covadonga-4", "republic", "madrid"]]);
  for (const entry of target.territories) state = holdWhole(target, state, entry.id, republic);
  const place = (id: UnitId): UnitState => ({ ...armyIn(state, "rep-wad-ras-1"), id });
  return {
    ...state,
    subTerritories: Object.fromEntries(Object.entries(state.subTerritories).map(([id, site]) => [id, { ...site, rail: 0 }])),
    raised: Object.fromEntries(raised.map((id) => [id, raisedDefinition(target, id)!])),
    units: { ...state.units, ...Object.fromEntries(raised.map((id) => [id, place(id)])) }
  };
}

const state = board([tank, truck]);
const twoAway = (routes: ReadonlyMap<TerritoryId, { readonly legs: readonly { readonly kind: string }[] }>): boolean =>
  [...routes.values()].some((route) => route.legs.length > 1 && route.legs.every((leg) => leg.kind === "land"));

describe("what counts as a truck", () => {
  it("reads it from the data: a type that carries and cannot fight", () => {
    const type = (id: string) => scenario.unitTypes.find((entry) => entry.id === id)!;
    expect([type("tank-company"), type("truck-column"), type("infantry-regiment")].map(carriesOf)).toEqual([1, 2, 0]);
    expect([type("tank-company"), type("truck-column"), type("anti-air-battery")].map(isTruckType)).toEqual([false, true, false]);
    expect(carriesOf(undefined)).toBe(0);
    expect([isTransport(scenario, state, tank), isTruck(scenario, state, tank)]).toEqual([true, false]);
    expect([isTransport(scenario, state, truck), isTruck(scenario, state, truck)]).toEqual([true, true]);
    expect([isTransport(scenario, state, foot), isTruck(scenario, state, unit("nobody"))]).toEqual([false, false]);
  });

  it("moves a tank two alone and with one unit on board, and one with two", () => {
    expect([[tank], [tank, foot], [tank, foot, second]].map((army) => truckBonus(scenario, state, army))).toEqual([1, 1, 0]);
  });
});

describe("the computer player's tanks", () => {
  it("march for themselves, two territories on, where trucks wait for an army", () => {
    const alone = board([tank]);
    expect(legalMoves(scenario, alone, armyIn(alone, tank)).some((order) => (order.legs?.length ?? 1) > 1)).toBe(true);
    expect(legalMoves(scenario, state, armyIn(state, truck))).toEqual([]);
    expect(threatReach(scenario, alone, armyIn(alone, tank)).size).toBeGreaterThan(threatReach(scenario, board([truck]), armyIn(board([truck]), truck)).size);
    // The tank's routes are its own, not those remembered for a gun beside it, which needs carrying.
    const gun = raise("artillery-group");
    const noTransport = board([gun]);
    expect(twoAway(unitRoutes(scenario, noTransport, armyIn(noTransport, gun)))).toBe(false);
    expect(twoAway(unitRoutes(scenario, alone, armyIn(alone, foot)))).toBe(true);
  });

  it("carry a regiment whose march needs them, and otherwise stay where they were left", () => {
    const alone = board([tank]);
    const far = legalMoves(scenario, alone, armyIn(alone, foot)).find((order) => order.legs?.length === 2 && order.legs.every((leg) => leg.kind === "land"))!;
    expect(withRoutes(scenario, alone, republic, [far]).map((order) => [order.unitId, order.to])).toEqual([[foot, far.to], [tank, far.to]]);
    const near = legalMoves(scenario, alone, armyIn(alone, foot)).find((order) => order.legs === undefined)!;
    expect(withRoutes(scenario, alone, republic, [near]).map((order) => order.unitId)).toEqual([foot]);
    // Two regiments are more than one tank carries.
    const both = withRoutes(scenario, alone, republic, [far, { ...far, unitId: second }]);
    expect(both.map((order) => order.unitId)).not.toContain(tank);
  });

  it("are recruited to fight, not as the truck an army lacks", () => {
    const start = initialGameState(scenario);
    const rich: GameState = { ...start, treasuries: { ...start.treasuries, [republic]: { funds: 500, manpower: 500 } as never } };
    // Trucks gone from the list: a tank never stands in for one, and is still bought on its merits.
    const tanksOnly: Scenario = { ...scenario, unitTypes: scenario.unitTypes.filter((type) => ["tank-company", "truck-column"].includes(type.id)) };
    const orders = planRecruits({ factionId: republic, memory: {}, planned: [], random: seededRandom(1), scenario: tanksOnly, state: rich });
    expect(orders.filter((order) => order.unitTypeId === "truck-column")).toHaveLength(1);
    expect(orders.some((order) => order.unitTypeId === "tank-company")).toBe(true);
  });
});

describe("the army summary", () => {
  const line = (raised: readonly UnitId[], army: readonly UnitId[], target: Scenario = scenario) => armyLeaving(target, board(raised, target), republic, madrid, army)?.line;

  it("says what carries the army, trucks or not", () => {
    expect(line([tank], [tank])).toBe("2 moves this turn: needs no trucks. Rail does not use moves.");
    expect(line([tank], [tank, foot])).toBe("2 moves this turn: transport for 1, 1 unit to carry. Rail does not use moves.");
    expect(line([tank, truck], [tank, truck, foot, second])).toBe("2 moves this turn: transport for 3, 2 units to carry. Rail does not use moves.");
    expect(line([truck], [truck, foot])).toBe("2 moves this turn: 1 truck for 1 unit. Rail does not use moves.");
    const noTrucks: Scenario = { ...scenario, unitTypes: scenario.unitTypes.filter((type) => !isTruckType(type)) };
    expect(line([], [foot], noTrucks)).toBe("1 move this turn: no trucks. Rail does not use moves.");
  });
});

describe("the Rev 3 rules data", () => {
  it("starts with no fortifications anywhere, and no Popular Resistance", () => {
    const sites = initialGameState(scenario).subTerritories;
    expect(Object.entries(sites).filter(([, site]) => site.buildings.includes("fortifications" as never)).map(([id]) => id)).toEqual([]);
    expect(scenario.d20.factionModifiers).toEqual([]);
    expect(scenario.d20.modifiers.barricades).toBe(2);
    expect(scenario.buildings.find((building) => building.id === "fortifications")?.effects).toEqual([{ kind: "defence-roll", roll: 2 }]);
  });

  it("lets trucks use any road, and pins a road rule of its own for the tests that need one", () => {
    expect(scenario.linkModifiers.road?.motorLevel).toBe("track");
    expect(pinned(scenario).linkModifiers.road?.motorLevel).toBe("main");
  });
});
