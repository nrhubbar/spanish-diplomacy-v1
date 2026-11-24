import { describe, expect, it } from "vitest";
import { applyBuildOrder, maxLevel, plannedSpend, siteRefusal, validateBuildOrder, withBuildOrders } from "../main/engine/economy/catalogue";
import { initialGameState } from "../main/engine/resolution";
import type { BuildOrder, BuildProject, BuildingId, DevelopmentId, GameState, Order, Resources, SubTerritoryId, UnitTypeId } from "../main/engine/types";
import { faction, spainWithAir, territory } from "./support";
import { pinned } from "./pinned";

/** $3-$5, D28.4: the build catalogue's limits on the Spanish board. */

const scenario = pinned(spainWithAir());
const republic = faction("republic");
const sub = (id: string): SubTerritoryId => id as SubTerritoryId;
const building = (id: string): BuildProject => ({ buildingId: id as BuildingId, kind: "building" });
const develop = (id: string): BuildProject => ({ developmentId: id as DevelopmentId, kind: "development" });
const order = (where: string, project: BuildProject): BuildOrder => ({ factionId: republic, kind: "build", project, subTerritoryId: sub(where) });

function rich(): GameState {
  const base = initialGameState(scenario);
  return { ...base, treasuries: { ...base.treasuries, [republic]: { funds: 99, manpower: 99 } as Resources } };
}

describe("where a building may go (D28.4, L18)", () => {
  const state = rich();

  it("Barracks only in a capital sub-territory, the only place it unlocks anything", () => {
    expect(siteRefusal(scenario, state, republic, sub("girona"), building("barracks"))).toBe("Capital sub-territory only.");
    // Alicante is not a capital, but has a city, so a Factory may be built there.
    expect(siteRefusal(scenario, state, republic, sub("alicante"), develop("factory"))).toBeUndefined();
    // Valencia's capital has both already; Murcia's capital may take a Depot.
    expect(siteRefusal(scenario, state, republic, sub("valencia"), building("barracks"))).toBe("Already built.");
    expect(siteRefusal(scenario, state, republic, sub("murcia"), building("depot"))).toBeUndefined();
    const capitals = new Set(scenario.territories.map((entry) => entry.capitalSubTerritoryId));
    for (const site of scenario.subTerritories) {
      if (!capitals.has(site.id)) expect(state.subTerritories[site.id]?.buildings.some((id) => id === "barracks")).toBe(false);
    }
  });

  it("a Factory needs a city, an upgrade needs its base, and other buildings go anywhere held", () => {
    expect(siteRefusal(scenario, state, republic, sub("girona"), develop("factory"))).toBe("Needs a city.");
    expect(siteRefusal(scenario, state, republic, sub("girona"), building("paved-airfield"))).toBe("Needs Airfield first.");
    expect(siteRefusal(scenario, state, republic, sub("girona"), building("hospital"))).toBeUndefined();
    expect(siteRefusal(scenario, state, republic, sub("girona"), develop("factory"))).toBe("Needs a city.");
    expect(siteRefusal(scenario, state, republic, sub("girona"), building("no-such-thing"))).toBe("Not available in this scenario.");
    expect(siteRefusal(scenario, state, republic, sub("nowhere"), building("hospital"))).toBe("Unknown sub-territory.");
    expect(siteRefusal(scenario, state, faction("north"), sub("girona"), building("hospital"))).toMatch(/is not yours/u);
  });

  it("levels stop at their maximum, rail and port included", () => {
    expect(maxLevel(scenario, { improvement: "rail", kind: "improvement" })).toBe(2);
    expect(maxLevel(scenario, { improvement: "port", kind: "improvement" })).toBe(2);
    expect(maxLevel(scenario, develop("unknown"))).toBe(0);
    // D3, declog D12: Barcelona starts at rail 2, its main lines' level, so a repair has nothing to raise.
    expect(siteRefusal(scenario, state, republic, sub("barcelona"), { improvement: "rail", kind: "improvement" })).toBe("Max level is 2.");
    // D4: Madrid lists no port.
    expect(siteRefusal(scenario, state, republic, sub("madrid"), { improvement: "port", kind: "improvement" })).toBe("Can't be built in Madrid.");
    expect(siteRefusal(scenario, state, republic, sub("barcelona"), develop("factory"))).toBeUndefined();
    expect(maxLevel(scenario, develop("factory"))).toBe(3);
  });
});

describe("queuing and pricing builds ($5)", () => {
  it("refuses an order it cannot pay and skips it in the planned state", () => {
    const base = initialGameState(scenario);
    const poor: GameState = { ...base, treasuries: { ...base.treasuries, [republic]: { funds: 1 } as Resources } };
    const failed = applyBuildOrder(scenario, poor, order("girona", building("hospital")));
    expect(failed).toEqual({ ok: false, reason: "Needs 5 more Funds." });
    expect(withBuildOrders(scenario, poor, [order("girona", building("hospital"))])).toBe(poor);
    const queued = applyBuildOrder(scenario, rich(), order("girona", building("hospital")));
    expect(queued.ok && queued.state.subTerritories[sub("girona")]?.queue).toHaveLength(1);
  });

  it("prices builds and recruits, and ignores what it does not know", () => {
    const orders: Order[] = [
      order("girona", building("hospital")),
      order("girona", building("no-such-thing")),
      { factionId: republic, kind: "recruit", territoryId: territory("catalunya"), unitTypeId: "infantry-regiment" as UnitTypeId },
      { factionId: republic, kind: "recruit", territoryId: territory("catalunya"), unitTypeId: "no-such-type" as UnitTypeId },
      { factionId: republic, kind: "replenish", unitId: "rep-sevilla-34" as never }
    ];
    expect(plannedSpend(scenario, orders)).toEqual({ funds: 12, manpower: 1 });
  });
});

describe("the Factory's Manpower (D3)", () => {
  const cantabria = (): BuildOrder => order("cantabria", develop("factory"));
  const short = (manpower: number): GameState => {
    const base = initialGameState(scenario);
    return { ...base, treasuries: { ...base.treasuries, [republic]: { funds: 99, manpower } as Resources } };
  };

  it("charges its 4 Manpower with the Funds when it is queued", () => {
    const applied = applyBuildOrder(scenario, short(10), cantabria());
    expect(applied.ok && applied.paid).toEqual({ funds: 6, manpower: 4 });
    expect(applied.ok && applied.state.treasuries[republic]).toEqual({ funds: 93, manpower: 6 });
    expect(plannedSpend(scenario, [cantabria()])).toEqual({ funds: 6, manpower: 4 });
  });

  it("refuses the order when the Manpower is short", () => {
    expect(applyBuildOrder(scenario, short(3), cantabria())).toEqual({ ok: false, reason: "Needs 1 more Manpower." });
    expect(validateBuildOrder(scenario, short(3), cantabria())).toEqual({ ok: false, reason: "Needs 1 more Manpower." });
  });
});
