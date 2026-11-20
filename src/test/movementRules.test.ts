import { describe, expect, it } from "vitest";
import { railReach } from "../main/engine/movement/network";
import { describeRoute, moveRoutes } from "../main/engine/movement/routes";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type { GameState, MoveLeg, MoveOrder, SubTerritoryId } from "../main/engine/types";
import { validateMoveOrder } from "../main/engine/validation";
import { faction, move, spainD20, territory, unit, withUnits } from "./support";

/**
 * Make-it-right regressions for the map and movement review on shipped Spain: M-1 (rail rides
 * are intercepted where the train passes, and cannot pass enemy armies) and M-10 (each sea lane
 * names its port at each end, Q-CITY-7).
 */

const sub = (id: string): SubTerritoryId => id as SubTerritoryId;

function holders(state: GameState, changes: Readonly<Record<string, string>>): GameState {
  const subTerritories = { ...state.subTerritories };
  for (const [id, holder] of Object.entries(changes)) {
    const before = subTerritories[sub(id)];
    if (before === undefined) throw new Error(id);
    subTerritories[sub(id)] = { ...before, holder: faction(holder) };
  }
  return { ...state, subTerritories };
}

const routed = (factionId: string, unitId: string, from: string, legs: readonly MoveLeg[]): MoveOrder => ({
  ...move(factionId, unitId, from, legs[legs.length - 1]?.to ?? from),
  legs
});

describe("rail rides past enemy armies (M-1, M2, Q-MR-16)", () => {
  const scenario = spainD20();

  it("does not run a train through contested ground where an enemy army stands", () => {
    const start = initialGameState(scenario);
    // The Basque column holds País Vasco's Republican half at the start.
    for (const ride of railReach(scenario, start, faction("north"), territory("castilla-y-leon")).values()) {
      expect(ride.through).not.toContain("pais-vasco");
    }
    // With the column gone, the same contested ground may be passed.
    const empty = withUnits(scenario, [["north-sierra-column", "north", "castilla-y-leon"]]);
    const passing = [...railReach(scenario, empty, faction("north"), territory("castilla-y-leon")).values()].filter((ride) => ride.through.includes(territory("pais-vasco")));
    expect(passing.length).toBeGreaterThan(0);
  });

  it("stops a ride at the first territory it passes that an enemy army enters", () => {
    const state = withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"], ["north-san-marcial-22", "north", "castilla-y-leon"]]);
    const ride = railReach(scenario, state, faction("republic"), territory("madrid")).get(territory("catalunya"));
    expect(ride?.through[0]).toBe("castilla-la-mancha");
    const route = describeRoute(scenario, state, faction("republic"), territory("madrid"), [{ kind: "rail", to: territory("catalunya") }]);
    expect(route.ok && route.route.transit).toEqual(ride?.through);
    const orders = [routed("republic", "rep-wad-ras-1", "madrid", [{ kind: "rail", to: territory("catalunya") }]), move("north", "north-san-marcial-22", "castilla-y-leon", "castilla-la-mancha")];
    expect(orders.map((order) => validateMoveOrder(scenario, state, order))).toEqual([{ ok: true }, { ok: true }]);
    const result = resolveTurn(scenario, state, [{ factionId: faction("republic"), orders: [orders[0] as MoveOrder] }, { factionId: faction("north"), orders: [orders[1] as MoveOrder] }], 1, () => () => 0.5);
    expect(result.outcomes).toContainEqual(expect.objectContaining({ kind: "move-intercepted", stoppedAt: "castilla-la-mancha", to: "catalunya", unitIds: ["rep-wad-ras-1"] }));
    expect(result.finalState.units[unit("rep-wad-ras-1")]?.territoryId).not.toBe("catalunya");
  });

  it("lets an unhindered ride arrive", () => {
    const state = withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"]]);
    const result = resolveTurn(scenario, state, [{ factionId: faction("republic"), orders: [routed("republic", "rep-wad-ras-1", "madrid", [{ kind: "rail", to: territory("catalunya") }])] }], 1);
    expect(result.finalState.units[unit("rep-wad-ras-1")]?.territoryId).toBe("catalunya");
    expect(result.outcomes.some((outcome) => outcome.kind === "move-intercepted")).toBe(false);
  });
});

describe("each sea lane names its ports (M-10, M5, Q-CITY-7)", () => {
  const scenario = spainD20();
  const toIslands: readonly MoveLeg[] = [{ kind: "sea", to: territory("islas-baleares") }];
  const base = withUnits(scenario, [["rep-durruti-column", "republic", "catalunya"]]);

  it("assaults Mallorca, the Balearic lane's port, even when the Republic holds Menorca", () => {
    expect(base.subTerritories[sub("menorca")]?.holder).toBe("republic");
    const route = describeRoute(scenario, base, faction("republic"), territory("catalunya"), toIslands);
    expect(route.ok && route.route.sea).toEqual({ departure: "barcelona", kind: "amphibious" });
  });

  it("lands normally in the lane's port when its side holds it", () => {
    const state = holders(base, { mallorca: "republic" });
    const route = describeRoute(scenario, state, faction("republic"), territory("catalunya"), toIslands);
    expect(route.ok && route.route.sea).toEqual({ departure: "barcelona", kind: "port", level: 2, port: "mallorca" });
  });

  it("sails only from the lane's port at the origin end", () => {
    const state = holders(base, { barcelona: "north" });
    // Tarragona is a Republican port, but the Balearic lane sails from Barcelona.
    expect(state.subTerritories[sub("tarragona")]?.port).toBeGreaterThan(0);
    const order = routed("republic", "rep-durruti-column", "catalunya", toIslands);
    expect(validateMoveOrder(scenario, state, order)).toEqual({ ok: false, reason: "An army can sail only from the lane's port, and your side must hold it." });
    expect(moveRoutes(scenario, base, faction("republic"), territory("catalunya"), [unit("rep-durruti-column")]).get(territory("islas-baleares"))?.shape).toBe("sea");
  });
});

describe("the computer player recruits trucks (M-5, M1, H5)", () => {
  it("adds a truck column where a Factory and a Depot allow it, while its trucks carry too few", async () => {
    const { planRecruits } = await import("../main/ai/orders/recruit");
    const { seededRandom } = await import("../main/engine/random");
    const scenario = spainD20();
    const start = initialGameState(scenario);
    const plan = (state: GameState) => planRecruits({ factionId: faction("republic"), memory: {}, planned: [], random: seededRandom(1), scenario, state });
    const trucks = (state: GameState) => plan(state).filter((order) => order.unitTypeId === "truck-column");
    expect(trucks(start)).toHaveLength(1);
    // The North has no capital with both a Factory and a Depot at the start.
    expect(planRecruits({ factionId: faction("north"), memory: {}, planned: [], random: seededRandom(1), scenario, state: start }).some((order) => order.unitTypeId === "truck-column")).toBe(false);
    // Enough trucks already: one for every two Republican units.
    const republicans = Object.values(start.units).filter((entry) => entry.factionId === "republic");
    const { raisedDefinition, raisedUnitId } = await import("../main/engine/recruitment/rules");
    const ids = republicans.map((_entry, index) => raisedUnitId(faction("republic"), "truck-column" as never, index + 1));
    const raised = Object.fromEntries(ids.map((id) => [id, raisedDefinition(scenario, id)]));
    const parked = Object.fromEntries(republicans.map((entry, index) => [ids[index], { ...entry, id: ids[index] }]));
    const supplied = { ...start, raised: { ...start.raised, ...raised }, units: { ...start.units, ...parked } } as GameState;
    expect(trucks(supplied)).toEqual([]);
  });
});
