import { describe, expect, it } from "vitest";
import { generateComputerSubmission } from "../main/ai/computerPlayer";
import { buildReserve, developmentTarget, planBuilds } from "../main/ai/orders/build";
import type { PlanningContext } from "../main/ai/orders/planner";
import { plannedSpend, validateBuildOrder } from "../main/engine/economy/catalogue";
import { amountOf } from "../main/engine/economy/resources";
import { seededRandom } from "../main/engine/random";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type { GameState, Order, ResourceId, Scenario, SubTerritoryId } from "../main/engine/types";
import { validateSubmission } from "../main/engine/validation";
import { viewFor } from "../main/engine/visibility";
import { loadPackage } from "../main/scenarios/loader";
import { modularMap, modularScenario } from "./modularFixture";
import { faction, spain, territory, tiny } from "./support";

const assetPaths = new Set(["src/test/fixtures/scenarios/tiny-front/geometry.svg", "src/test/fixtures/scenarios/tiny-front/foot.svg"]);
const scenario = loadPackage({ assetPaths, mapDocument: modularMap(), mapPath: "m", scenarioDocument: modularScenario(), scenarioPath: "s" }).scenario;
const funds = "funds" as ResourceId;
const budget = (target: Scenario, id: string) => target.ai.profiles[faction(id)]!.builds!;

/** A tie-break source that fails the test if a planner draws from it. */
const noDraws = { next: (): number => { throw new Error("The build planner must not draw from the tie-break source."); } } as unknown as PlanningContext["random"];

function contextFor(target: Scenario, state: GameState, factionId: string, planned: readonly Order[] = []): PlanningContext {
  return { factionId: faction(factionId), memory: {}, planned, random: noDraws, scenario: target, state: viewFor(target, state, faction(factionId)) };
}

describe("computer Build orders (H5)", () => {
  it("builds within its budget, each order valid on its own, without drawing random numbers", () => {
    const state = { ...initialGameState(scenario), treasuries: { [faction("red")]: { [funds]: 20 }, [faction("blue")]: { [funds]: 20 } } };
    const orders = planBuilds(contextFor(scenario, state, "red"));
    expect(orders.length).toBeGreaterThan(0);
    expect(orders.length).toBeLessThanOrEqual(budget(scenario, "red").maxOrdersPerTurn);
    for (const order of orders) expect(validateBuildOrder(scenario, state, order)).toEqual({ ok: true });
    expect(amountOf(plannedSpend(scenario, orders), funds)).toBeLessThanOrEqual(20 * budget(scenario, "red").spendShare);
    expect(new Set(orders.map((order) => order.subTerritoryId)).size).toBe(orders.length);
    expect(planBuilds(contextFor(scenario, state, "red"))).toEqual(orders);
  });

  it("reads its budget from the faction's AI profile (EB-15)", () => {
    expect(budget(spain(), "south")).toEqual({ developmentProjects: 1, itemsPerEmptyQueue: 1, maxOrdersPerTurn: 3, reserveShare: 0.3, spendShare: 0.6 });
    const state = { ...initialGameState(scenario), treasuries: { [faction("red")]: { [funds]: 40 } } };
    const withBudget = (builds: NonNullable<Scenario["ai"]["profiles"][never]["builds"]>): Scenario => ({
      ...scenario,
      ai: { ...scenario.ai, profiles: { ...scenario.ai.profiles, [faction("red")]: { ...scenario.ai.profiles[faction("red")]!, builds } } }
    });
    expect(planBuilds(contextFor(withBudget({ developmentProjects: 0, itemsPerEmptyQueue: 1, maxOrdersPerTurn: 0, reserveShare: 0.3, spendShare: 0.6 }), state, "red"))).toEqual([]);
    expect(planBuilds(contextFor(withBudget({ developmentProjects: 0, itemsPerEmptyQueue: 1, maxOrdersPerTurn: 3, reserveShare: 0.3, spendShare: 0 }), state, "red"))).toEqual([]);
    const one = planBuilds(contextFor(withBudget({ developmentProjects: 0, itemsPerEmptyQueue: 1, maxOrdersPerTurn: 1, reserveShare: 0.3, spendShare: 1 }), state, "red"));
    expect(one).toHaveLength(1);
    const two = planBuilds(contextFor(withBudget({ developmentProjects: 0, itemsPerEmptyQueue: 2, maxOrdersPerTurn: 9, reserveShare: 0.3, spendShare: 1 }), state, "red"));
    const perSite = new Map<string, number>();
    for (const order of two) perSite.set(order.subTerritoryId, (perSite.get(order.subTerritoryId) ?? 0) + 1);
    expect(Math.max(...perSite.values())).toBe(2);
  });

  it("repairs damaged rail first", () => {
    const start = initialGameState(scenario);
    const hills = "west-hills" as SubTerritoryId;
    const state = { ...start, subTerritories: { ...start.subTerritories, [hills]: { ...start.subTerritories[hills]!, rail: 0 } } };
    expect(planBuilds(contextFor(scenario, state, "red"))[0]).toMatchObject({ project: { improvement: "rail" }, subTerritoryId: hills });
  });

  it("leaves what this turn's recruits cost", () => {
    const state = { ...initialGameState(scenario), treasuries: { [faction("red")]: { [funds]: 4 } } };
    const recruit: Order = { factionId: faction("red"), kind: "recruit", territoryId: territory("westfold"), unitTypeId: "foot" as never };
    expect(planBuilds(contextFor(scenario, state, "red", [recruit]))).toEqual([]);
  });

  it("gives nothing without an economy", () => {
    expect(planBuilds(contextFor(tiny(), initialGameState(tiny()), "red"))).toEqual([]);
  });

  it("plays Spain for several turns with valid submissions that build", () => {
    const target = spain();
    let state = initialGameState(target);
    let built = 0;
    for (let turn = 1; turn <= 4; turn += 1) {
      const submissions = target.factions.map((entry, index) => generateComputerSubmission(target, state, entry.id, seededRandom(turn * 10 + index)));
      for (const submission of submissions) expect(validateSubmission(target, state, submission.factionId, submission)).toEqual({ ok: true });
      const result = resolveTurn(target, state, submissions, 5);
      built += result.outcomes.filter((outcome) => outcome.kind === "build-queued").length;
      expect(result.outcomes.filter((outcome) => (outcome.kind === "rejected-order" && outcome.order.kind === "build") || (outcome.kind === "build-refunded" && outcome.reason !== "captured"))).toEqual([]);
      state = { ...result.finalState, turnNumber: state.turnNumber + 1 };
    }
    expect(built).toBeGreaterThan(0);
  });
});

describe("computer development and support builds (M5, m4, m5)", () => {
  const target = spain();
  const republic = faction("republic");

  it("queues development for every faction within a few turns, and fortifies a territory once, in its capital", () => {
    let state = initialGameState(target);
    const developed = new Set<string>();
    for (let turn = 1; turn <= 6; turn += 1) {
      const submissions = target.factions.map((entry, index) => generateComputerSubmission(target, state, entry.id, seededRandom(turn * 10 + index)));
      const result = resolveTurn(target, state, submissions, 5);
      for (const outcome of result.outcomes) {
        if (outcome.kind === "build-queued" && outcome.order.project.kind === "development") developed.add(outcome.order.factionId);
      }
      state = { ...result.finalState, turnNumber: state.turnNumber + 1 };
      // m4: never two defence-roll buildings, built or queued, in one territory; and only in capitals.
      for (const territory of target.territories) {
        const forts = (target.index.subTerritoriesByTerritory.get(territory.id) ?? []).filter((sub) => {
          const site = state.subTerritories[sub.id];
          return site !== undefined && (site.buildings.includes("fortifications" as never) || site.queue.some((item) => item.project.kind === "building" && item.project.buildingId === "fortifications"));
        });
        expect(forts.length).toBeLessThanOrEqual(1);
        for (const sub of forts) expect(sub.id).toBe(territory.capitalSubTerritoryId);
      }
    }
    expect([...developed].sort()).toEqual(target.factions.map((entry) => entry.id).sort());
  });

  it("the Recruit planner saves the development item's price, and never holds Manpower back", () => {
    const start = initialGameState(target);
    const view = viewFor(target, start, republic);
    const context = { factionId: republic, scenario: target, state: view };
    const saving = developmentTarget(context);
    expect(saving?.order.project.kind).toBe("development");
    const reserve = buildReserve(context, { funds: 4, manpower: 50 } as never);
    expect(Object.keys(reserve)).toEqual(["funds"]);
    expect(amountOf(reserve, funds)).toBe(amountOf(saving!.price, funds));
    // With an item already queued, it keeps only the profile's share.
    const queued = saving!.order;
    const busy: GameState = { ...start, subTerritories: { ...start.subTerritories, [queued.subTerritoryId]: { ...start.subTerritories[queued.subTerritoryId]!, queue: [{ factionId: republic, paid: {}, progress: 0, project: queued.project }] } } };
    expect(developmentTarget({ ...context, state: viewFor(target, busy, republic) })).toBeUndefined();
    expect(buildReserve({ ...context, state: viewFor(target, busy, republic) }, { funds: 40 } as never)).toEqual({ funds: 12 });
  });

  it("builds a Hospital at a front capital and a Rail yard where there is rail, once a territory, when nothing better is left", () => {
    const start = initialGameState(target);
    // Plenty of money and nothing else to buy: every capital already has its unlocking buildings and Fortifications.
    const capitals = new Set(target.territories.map((entry) => entry.capitalSubTerritoryId));
    const everything = ["barracks", "factory", "depot", "airfield", "fortifications"];
    const subTerritories = Object.fromEntries(Object.entries(start.subTerritories).map(([id, site]) => [id, capitals.has(id as SubTerritoryId)
      ? { ...site, buildings: [...new Set([...site.buildings, ...everything.filter((building) => building !== "factory" || target.cities.some((entry) => entry.subTerritoryId === id))])] as never[], development: Object.fromEntries(Object.keys(site.development).map((track) => [track, 3])) }
      : site]));
    const state: GameState = { ...start, subTerritories, treasuries: { ...start.treasuries, [republic]: { funds: 200, manpower: 50 } as never } };
    const sansDevelopment: Scenario = { ...target, ai: { ...target.ai, profiles: { ...target.ai.profiles, [republic]: { ...target.ai.profiles[republic]!, builds: { ...target.ai.profiles[republic]!.builds!, developmentProjects: 0, itemsPerEmptyQueue: 3, maxOrdersPerTurn: 40, spendShare: 1 } } } } };
    const orders = planBuilds(contextFor(sansDevelopment, state, "republic"));
    const kinds = orders.flatMap((order) => (order.project.kind === "building" ? [order.project.buildingId] : []));
    expect(kinds).toContain("hospital");
    expect(kinds).toContain("rail-yard");
    expect(kinds).not.toContain("fortifications");
    const perTerritory = new Map<string, number>();
    for (const order of orders.filter((entry) => entry.project.kind === "building" && entry.project.buildingId === "hospital")) {
      const territoryId = target.index.subTerritories.get(order.subTerritoryId)!.territoryId;
      perTerritory.set(territoryId, (perTerritory.get(territoryId) ?? 0) + 1);
    }
    expect(Math.max(...perTerritory.values())).toBe(1);
  });
});
