import { describe, expect, it } from "vitest";
import { generateComputerSubmission } from "../main/ai/computerPlayer";
import { planBuilds } from "../main/ai/orders/build";
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
    expect(budget(spain(), "south")).toEqual({ itemsPerEmptyQueue: 1, maxOrdersPerTurn: 3, spendShare: 0.6 });
    const state = { ...initialGameState(scenario), treasuries: { [faction("red")]: { [funds]: 40 } } };
    const withBudget = (builds: NonNullable<Scenario["ai"]["profiles"][never]["builds"]>): Scenario => ({
      ...scenario,
      ai: { ...scenario.ai, profiles: { ...scenario.ai.profiles, [faction("red")]: { ...scenario.ai.profiles[faction("red")]!, builds } } }
    });
    expect(planBuilds(contextFor(withBudget({ itemsPerEmptyQueue: 1, maxOrdersPerTurn: 0, spendShare: 0.6 }), state, "red"))).toEqual([]);
    expect(planBuilds(contextFor(withBudget({ itemsPerEmptyQueue: 1, maxOrdersPerTurn: 3, spendShare: 0 }), state, "red"))).toEqual([]);
    const one = planBuilds(contextFor(withBudget({ itemsPerEmptyQueue: 1, maxOrdersPerTurn: 1, spendShare: 1 }), state, "red"));
    expect(one).toHaveLength(1);
    const two = planBuilds(contextFor(withBudget({ itemsPerEmptyQueue: 2, maxOrdersPerTurn: 9, spendShare: 1 }), state, "red"));
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
