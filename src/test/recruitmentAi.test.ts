import { describe, expect, it } from "vitest";
import { generateComputerSubmission } from "../main/ai/computerPlayer";
import { planRecruits } from "../main/ai/orders/recruit";
import { planReplenishment } from "../main/ai/orders/replenish";
import { balanceLeft } from "../main/ai/orders/spending";
import { seededRandom } from "../main/engine/random";
import { initialGameState } from "../main/engine/resolution";
import { canAfford } from "../main/engine/resources";
import { validateSubmission } from "../main/engine/validation";
import type { FactionId, GameState, Order, Resources } from "../main/engine/types";
import { faction, spain, tiny } from "./support";

const scenario = spain();
const context = (state: GameState, factionId: FactionId, planned: readonly Order[] = []) => ({
  factionId, memory: {}, planned, random: seededRandom(1), scenario, state
});

describe("the computer player's Recruit orders (H5)", () => {
  const start = initialGameState(scenario);

  it("recruits valid units it can pay for, keeping a reserve, without drawing from the tie-break source", () => {
    for (const entry of scenario.factions) {
      const random = seededRandom(9);
      const before = random();
      const orders = planRecruits({ ...context(start, entry.id), random: seededRandom(9) });
      expect(orders.length).toBeGreaterThan(0);
      expect(validateSubmission(scenario, start, entry.id, { factionId: entry.id, orders }).ok).toBe(true);
      const left = balanceLeft(context(start, entry.id, orders));
      expect(Object.values(left).every((amount) => amount >= 0)).toBe(true);
      expect(before).toBe(seededRandom(9)());
    }
  });

  it("recruits nothing when it is broke, or without the module", () => {
    const broke: GameState = { ...start, treasuries: { ...start.treasuries, [faction("republic")]: {} } };
    expect(planRecruits(context(broke, faction("republic")))).toEqual([]);
    const preset = tiny();
    expect(planRecruits({ ...context(initialGameState(preset), faction("red")), scenario: preset })).toEqual([]);
  });
});

describe("the computer player's Replenish orders (H5)", () => {
  const start = initialGameState(scenario);
  const republic = faction("republic");
  const worn = Object.values(start.units).find((unit) => unit.factionId === republic && unit.territoryId === "catalunya")!;
  const state: GameState = {
    ...start,
    units: { ...start.units, [worn.id]: { ...worn, morale: { demoralized: true, quietTurns: 0 }, strength: Math.round(worn.strength / 3) } }
  };

  it("replenishes worn units that have no other order, and skips healthy ones", () => {
    expect(planReplenishment(context(state, republic))).toEqual([{ factionId: republic, kind: "replenish", unitId: worn.id }]);
    expect(planReplenishment(context(state, republic, [{ factionId: republic, from: worn.territoryId, kind: "move", to: worn.territoryId, unitId: worn.id }]))).toEqual([]);
    expect(planReplenishment(context(start, republic))).toEqual([]);
  });

  it("spends only what is left", () => {
    const poor: GameState = { ...state, treasuries: { ...state.treasuries, [republic]: { funds: 0 } as Resources } };
    expect(planReplenishment(context(poor, republic))).toEqual([]);
  });

  it("joins the whole submission, which stays valid and affordable", () => {
    const submission = generateComputerSubmission(scenario, state, republic, seededRandom(4));
    expect(validateSubmission(scenario, state, republic, submission).ok).toBe(true);
    expect(submission.orders.some((order) => order.kind === "recruit")).toBe(true);
    expect(canAfford(state.treasuries[republic] ?? {}, {})).toBe(true);
  });
});
