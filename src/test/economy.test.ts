import { describe, expect, it } from "vitest";
import { buildRefusal, plannedSpend, siteRefusal, validateBuildOrder, withBuildOrders } from "../main/engine/economy/catalogue";
import { buildingCombatModifiers, buildingReplenishBonus } from "../main/engine/economy/effects";
import { isContested, territoriesHeldWhole, wholeHolder } from "../main/engine/economy/holdings";
import { incomeFor, subTerritoryYield } from "../main/engine/economy/income";
import { advanceQueues, damageRail, handOverQueues } from "../main/engine/economy/queues";
import { sumResources, canAfford, credit, isEmptyAmount, pay, shortfall, subtractResources } from "../main/engine/economy/resources";
import type { SystemState } from "../main/engine/phases/draft";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type {
  BuildOrder,
  BuildProject,
  BuildingId,
  DevelopmentId,
  GameState,
  ResourceId,
  Resources,
  Scenario,
  SubTerritoryId,
  SubTerritoryState
} from "../main/engine/types";
import type { RuleModule } from "../main/engine/modules";
import { validateOrder } from "../main/engine/validation";
import { outcomesFor } from "../main/engine/visibility";
import { amountText, resourceAmount, resourceAmountInFull, signedAmountText, signedResourceAmount } from "../main/presentation/economy";
import { loadPackage } from "../main/scenarios/loader";
import { modularMap, modularScenario } from "./modularFixture";
import { faction, spain, territory, unit } from "./support";

const assetPaths = new Set(["src/test/fixtures/scenarios/tiny-front/geometry.svg", "src/test/fixtures/scenarios/tiny-front/foot.svg"]);
const scenario = loadPackage({ assetPaths, mapDocument: modularMap(), mapPath: "m", scenarioDocument: modularScenario(), scenarioPath: "s" }).scenario;

const sub = (id: string): SubTerritoryId => id as SubTerritoryId;
const funds = (value: number): Resources => ({ ["funds" as never]: value });
const building = (id: string): BuildProject => ({ buildingId: id as BuildingId, kind: "building" });
const develop = (id: string): BuildProject => ({ developmentId: id as DevelopmentId, kind: "development" });
const rail: BuildProject = { improvement: "rail", kind: "improvement" };
const build = (factionId: string, subTerritoryId: string, project: BuildProject): BuildOrder => ({ factionId: faction(factionId), kind: "build", project, subTerritoryId: sub(subTerritoryId) });

function withSites(state: GameState, sites: Readonly<Record<string, Partial<SubTerritoryState>>>): GameState {
  const subTerritories = { ...state.subTerritories };
  for (const [id, change] of Object.entries(sites)) subTerritories[sub(id)] = { ...subTerritories[sub(id)]!, ...change };
  return { ...state, subTerritories };
}

const systemsOf = (state: GameState): SystemState => ({
  generals: state.generals,
  raidCuts: state.raidCuts,
  raised: state.raised,
  reveals: state.reveals,
  subTerritories: state.subTerritories,
  training: state.training,
  treasuries: state.treasuries
});

/** The fixture with West Hills' station wrecked, so a rail repair there has a level to restore (declog D12). */
const start = (): GameState => {
  const state = initialGameState(scenario);
  const hills = state.subTerritories[sub("west-hills")];
  if (hills === undefined) throw new Error("fixture");
  return { ...state, subTerritories: { ...state.subTerritories, [sub("west-hills")]: { ...hills, rail: 0 } } };
};

describe("resource arithmetic ($1)", () => {
  it("adds, subtracts, checks and pays", () => {
    expect(sumResources(funds(2), funds(3), { ["manpower" as never]: 1 })).toEqual({ funds: 5, manpower: 1 });
    expect(subtractResources(funds(2), funds(3))).toEqual({ funds: -1 });
    expect(canAfford(funds(4), funds(4))).toBe(true);
    expect(canAfford({}, funds(1))).toBe(false);
    expect(shortfall(funds(1), funds(4))).toEqual({ funds: 3 });
    expect(isEmptyAmount({ funds: 0 } as Resources)).toBe(true);
    const treasuries = { [faction("red")]: funds(5) };
    expect(pay(treasuries, faction("red"), funds(6))).toBeUndefined();
    expect(pay(treasuries, faction("red"), funds(5))?.[faction("red")]).toEqual({ funds: 0 });
    expect(credit(treasuries, faction("blue"), funds(2))[faction("blue")]).toEqual({ funds: 2 });
  });
});

describe("holdings (W6)", () => {
  it("reads whole and contested territories from sub-territory holders", () => {
    const state = withSites(start(), { "west-hills": { holder: faction("blue") } });
    expect(wholeHolder(scenario, start().subTerritories, territory("westfold"))).toBe("red");
    expect(isContested(scenario, state.subTerritories, territory("westfold"))).toBe(true);
    expect(territoriesHeldWhole(scenario, state.subTerritories, faction("red"))).toEqual(["highlands"]);
  });
});

describe("income ($2, $3)", () => {
  it("sums development yields in territories held whole", () => {
    expect(subTerritoryYield(scenario, { development: { ["farms" as never]: 2 } })).toEqual({ manpower: 2 });
    const red = incomeFor(scenario, start(), faction("red"));
    expect(red.paid).toEqual({ funds: 2, manpower: 3 });
    expect(red.cut).toEqual({});
    expect(incomeFor(scenario, start(), faction("blue")).paid).toEqual({ funds: 4 });
  });

  it("pays nothing for a contested territory", () => {
    const state = withSites(start(), { "west-hills": { holder: faction("blue") } });
    expect(incomeFor(scenario, state, faction("red")).paid).toEqual({});
    expect(incomeFor(scenario, state, faction("blue")).paid).toEqual({ funds: 4 });
  });

  it("applies incomeDelta hooks (raid cuts) and names the cut sub-territories", () => {
    const raid: RuleModule = { area: "air", blocks: [], hooks: { incomeDelta: ({ factionId }) => (factionId === "red" ? { ["funds" as never]: -5 } : {}) }, id: "raid-test", steps: {} };
    // The fixture's own air module (m3r1-air-generals) also cuts; this test pins the seam alone.
    const raided: Scenario = { ...scenario, modules: [...scenario.modules.filter((module) => module.area !== "air"), raid] };
    const state: GameState = { ...start(), raidCuts: [{ factionId: faction("red"), subTerritoryId: sub("west-town-quarter"), turnNumber: 1 }, { factionId: faction("red"), subTerritoryId: sub("west-hills"), turnNumber: 0 }] };
    const income = incomeFor(raided, state, faction("red"));
    expect(income.paid).toEqual({ funds: 0, manpower: 3 });
    expect(income.cut).toEqual({ funds: 2 });
    expect(income.cutSubTerritoryIds).toEqual(["west-town-quarter"]);
  });

  it("is what the turn pays at step 11, the same as the preview", () => {
    const state = start();
    const preview = incomeFor(scenario, state, faction("red")).paid;
    const result = resolveTurn(scenario, state, [], 7);
    expect(result.finalState.treasuries[faction("red")]).toEqual(sumResources(state.treasuries[faction("red")]!, preview));
    expect(result.outcomes.flatMap((outcome) => (outcome.kind === "income" ? [outcome.factionId] : []))).toEqual(["red", "blue"]);
  });
});

describe("Build orders ($4, $5)", () => {
  it("validates against the catalogue's limits", () => {
    const state = start();
    expect(siteRefusal(scenario, state, faction("red"), sub("port-quarter"), building("airfield"))).toMatch(/not yours/);
    expect(siteRefusal(scenario, state, faction("red"), sub("west-town-quarter"), building("barracks"))).toBe("Already built.");
    expect(siteRefusal(scenario, state, faction("red"), sub("west-hills"), building("palace"))).toBe("Capital sub-territory only.");
    expect(siteRefusal(scenario, state, faction("red"), sub("highlands"), building("palace"))).toBe("Needs a city.");
    expect(siteRefusal(scenario, state, faction("red"), sub("west-town-quarter"), building("paved-airfield"))).toBe("Needs Airfield first.");
    expect(siteRefusal(scenario, state, faction("red"), sub("west-hills"), develop("industry"))).toBe("Needs a city.");
    expect(siteRefusal(scenario, state, faction("red"), sub("west-town-quarter"), building("palace"))).toBeUndefined();
    expect(siteRefusal(scenario, state, faction("red"), sub("nowhere"), rail)).toBe("Unknown sub-territory.");
    // Declog D12: a station is repaired up to its best link, single rail (1) here.
    expect(siteRefusal(scenario, withSites(state, { "west-hills": { rail: 1 } }), faction("red"), sub("west-hills"), rail)).toBe("Max level is 1.");
    const contested = withSites(state, { highlands: { holder: faction("red") }, "west-hills": { holder: faction("blue") } });
    expect(siteRefusal(scenario, contested, faction("red"), sub("west-town-quarter"), rail)).toMatch(/Contested/);
    expect(buildRefusal(scenario, state, build("red", "west-town-quarter", building("palace")))).toBeUndefined();
    expect(buildRefusal(scenario, { ...state, treasuries: { [faction("red")]: funds(2) } }, build("red", "west-town-quarter", building("palace")))).toBe("Needs 7 more Funds.");
  });

  it("counts queued items toward levels and upgrades", () => {
    const queued = withBuildOrders(scenario, start(), [build("red", "west-town-quarter", building("airfield")), build("red", "west-hills", rail)]);
    expect(siteRefusal(scenario, queued, faction("red"), sub("west-town-quarter"), building("airfield"))).toBe("Already in the queue.");
    expect(siteRefusal(scenario, queued, faction("red"), sub("west-town-quarter"), building("paved-airfield"))).toBeUndefined();
    expect(queued.treasuries[faction("red")]).toEqual({ funds: 1, manpower: 5 });
    const twice = withBuildOrders(scenario, start(), [build("red", "west-hills", rail), build("red", "west-hills", rail)]);
    expect(twice.subTerritories[sub("west-hills")]?.queue).toHaveLength(1);
  });

  it("goes through the validation gateway, and not without the economy module", () => {
    expect(validateOrder(scenario, start(), build("red", "west-hills", rail))).toEqual({ ok: true });
    const off: Scenario = { ...scenario, rules: { ...scenario.rules, economy: "none" } };
    expect(validateBuildOrder(off, start(), build("red", "west-hills", rail)).ok).toBe(false);
  });

  it("totals planned spending, recruits included", () => {
    const recruit = { factionId: faction("red"), kind: "recruit", territoryId: territory("westfold"), unitTypeId: "foot" } as const;
    expect(plannedSpend(scenario, [build("red", "west-hills", rail), recruit as never])).toEqual({ funds: 7, manpower: 2 });
  });

  it("pays when queued at step 1 and refuses, privately, what the balance no longer covers", () => {
    const orders = [build("red", "west-town-quarter", building("palace")), build("red", "west-hills", rail), build("red", "west-hills", develop("farms"))];
    const result = resolveTurn(scenario, start(), [{ factionId: faction("red"), orders }], 3);
    const queued = result.outcomes.filter((outcome) => outcome.kind === "build-queued");
    const failed = result.outcomes.filter((outcome) => outcome.kind === "build-refunded");
    expect(queued).toHaveLength(1);
    expect(failed).toHaveLength(2);
    expect(failed[0]).toMatchObject({ reason: "Needs 2 more Funds.", refund: {} });
    expect(result.outcomes.some((outcome) => outcome.kind === "rejected-order")).toBe(false);
    // $6: the failure is private: another faction does not see it.
    const seenByBlue = outcomesFor(scenario, result.finalState, result.outcomes, faction("blue"));
    expect(seenByBlue.some((outcome) => outcome.kind === "build-refunded" || outcome.kind === "build-queued")).toBe(false);
    // 10 - 9 paid, + 2 income.
    expect(result.finalState.treasuries[faction("red")]).toMatchObject({ funds: 3 });
    expect(result.finalState.subTerritories[sub("west-town-quarter")]?.queue[0]).toMatchObject({ progress: 1 });
  });

  it("finishes after its turns, one item at a time", () => {
    let state: GameState = start();
    const orders = [build("red", "west-hills", rail), build("red", "west-hills", develop("farms"))];
    let result = resolveTurn(scenario, state, [{ factionId: faction("red"), orders }], 1);
    expect(result.finalState.subTerritories[sub("west-hills")]?.queue.map((item) => item.progress)).toEqual([1, 0]);
    state = { ...result.finalState, turnNumber: 2 };
    result = resolveTurn(scenario, state, [], 1);
    expect(result.outcomes.some((outcome) => outcome.kind === "build-completed")).toBe(true);
    expect(result.finalState.subTerritories[sub("west-hills")]).toMatchObject({ rail: 1 });
    state = { ...result.finalState, turnNumber: 3 };
    result = resolveTurn(scenario, { ...state, turnNumber: 4 }, [], 1);
    result = resolveTurn(scenario, { ...result.finalState, turnNumber: 5 }, [], 1);
    expect(result.finalState.subTerritories[sub("west-hills")]?.development).toMatchObject({ farms: 3 });
  });
});

describe("queues on capture and in contested ground ($5, $8)", () => {
  const busy = (): GameState => withSites(start(), {
    "west-hills": {
      queue: [
        { factionId: faction("red"), paid: funds(3), progress: 1, project: rail },
        { factionId: faction("red"), paid: funds(3), progress: 0, project: develop("farms") }
      ]
    }
  });

  it("forfeits the item in progress to the new holder and refunds the rest", () => {
    const before = busy().subTerritories;
    const captured = systemsOf(withSites(busy(), { "west-hills": { holder: faction("blue") } }));
    const { events, systems } = handOverQueues(scenario, before, captured);
    expect(systems.subTerritories[sub("west-hills")]?.queue).toEqual([{ factionId: "blue", paid: {}, progress: 1, project: rail }]);
    expect(systems.treasuries[faction("red")]).toMatchObject({ funds: 13 });
    expect(events.map((event) => event.kind)).toEqual(["build-refunded", "build-forfeited"]);
  });

  it("refunds an item that had not started", () => {
    const state = withSites(start(), { "west-hills": { queue: [{ factionId: faction("red"), paid: funds(3), progress: 0, project: rail }] } });
    const { events, systems } = handOverQueues(scenario, state.subTerritories, systemsOf(withSites(state, { "west-hills": { holder: faction("blue") } })));
    expect(systems.subTerritories[sub("west-hills")]?.queue).toEqual([]);
    expect(events).toHaveLength(1);
  });

  it("pauses queues while the territory is contested", () => {
    const contested = systemsOf(withSites(busy(), { "west-town-quarter": { holder: faction("blue") } }));
    const { events, systems } = advanceQueues(scenario, contested);
    expect(events).toEqual([]);
    expect(systems.subTerritories[sub("west-hills")]?.queue[0]?.progress).toBe(1);
  });

  it("damages rail in the attacker's sub-territories when a territory becomes contested", () => {
    const before = start().subTerritories;
    const after = systemsOf(withSites(start(), { "west-hills": { holder: faction("blue"), rail: 1 } }));
    const { events, systems } = damageRail(scenario, before, after);
    expect(events).toEqual([{ after: 0, before: 1, kind: "rail-damaged", subTerritoryId: "west-hills" }]);
    expect(systems.subTerritories[sub("west-town-quarter")]?.rail).toBe(2);
    expect(damageRail(scenario, after.subTerritories, after).events).toEqual([]);
  });
});

describe("building effects through the hooks ($4)", () => {
  const fortified: Scenario = {
    ...scenario,
    index: {
      ...scenario.index,
      buildings: new Map([...scenario.index.buildings, ["fort" as BuildingId, { capitalOnly: false, cityOnly: false, cost: funds(1), effects: [{ kind: "defence-roll", roll: 1 }, { kind: "replenish-cap", share: 0.25 }, { kind: "replenish-discount", resource: "funds" as ResourceId, share: 0.5 }], id: "fort" as BuildingId, name: "Fort", turns: 1 }]])
    }
  };
  const state = withSites(start(), { "west-hills": { buildings: ["fort" as BuildingId] } });

  it("takes Fortifications off the attacker's roll when a defender holds them", () => {
    const context = { attackerFactionId: faction("blue"), defenderFactionIds: [faction("red")], diggingIn: true, scenario: fortified, state, territoryId: territory("westfold") };
    expect(buildingCombatModifiers(context)).toEqual([{ buildingId: "fort", kind: "building", roll: -1, subTerritoryId: "west-hills" }]);
    expect(buildingCombatModifiers({ ...context, defenderFactionIds: [faction("blue")] })).toEqual([]);
  });

  it("gives replenishment bonuses to the holder's units", () => {
    const red = Object.values(state.units).find((candidate) => candidate.factionId === "red")!;
    expect(buildingReplenishBonus({ scenario: fortified, state, territoryId: territory("westfold"), unitId: red.id })).toEqual({ capShare: 0.25, discount: { funds: 0.5 } });
    expect(buildingReplenishBonus({ scenario: fortified, state, territoryId: territory("westfold"), unitId: unit("ghost") })).toEqual({ capShare: 0, discount: {} });
  });
});

describe("resource display scale (EB-12)", () => {
  const spanish = spain();
  const manpower = "manpower" as never;
  const fundsId = "funds" as never;

  it("reads Manpower in thousands, as the approved capture, and Funds as plain numbers", () => {
    expect(spanish.resources.find((resource) => resource.id === manpower)?.display).toEqual({ suffix: "k", unit: 1000 });
    expect(resourceAmount(spanish, manpower, 18)).toBe("18k");
    expect(signedResourceAmount(spanish, manpower, 9)).toBe("+9k");
    expect(signedResourceAmount(spanish, manpower, -3)).toBe("\u22123k");
    expect(resourceAmountInFull(spanish, manpower, 1234)).toBe("1,234,000");
    expect(resourceAmount(spanish, fundsId, 42)).toBe("42");
    expect(resourceAmountInFull(spanish, fundsId, 42)).toBe("42");
    expect(amountText(spanish, { [fundsId]: 6, [manpower]: 3 } as Resources)).toBe("6 Funds \u00b7 3k Manpower");
    expect(signedAmountText(spanish, { [fundsId]: -2, [manpower]: 1 } as Resources)).toBe("\u22122 Funds \u00b7 +1k Manpower");
  });

  it("leaves a scenario without a display block in plain numbers", () => {
    expect(scenario.resources.every((resource) => resource.display === undefined)).toBe(true);
    expect(amountText(scenario, { [manpower]: 3 } as Resources)).toBe("3 Manpower");
  });
});

describe("Spain's economy", () => {
  it("pays every faction something on turn 1", () => {
    const scenarioSpain = spain();
    const state = initialGameState(scenarioSpain);
    const income = Object.fromEntries(scenarioSpain.factions.map((f) => [f.id, incomeFor(scenarioSpain, state, f.id).paid]));
    expect(Object.keys(income)).toEqual(["republic", "north", "south"]);
    for (const value of Object.values(income)) expect(isEmptyAmount(value)).toBe(false);
  });
});
