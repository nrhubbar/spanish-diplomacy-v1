import { describe, expect, it, vi } from "vitest";
import { applyBlunders } from "../main/ai/blunder";
import { generateComputerSubmission } from "../main/ai/computerPlayer";
import { rollStream } from "../main/engine/dice";
import { seededRandom } from "../main/engine/random";
import { initialGameState } from "../main/engine/resolution";
import { isMoveOrder, type Order, type Scenario, type UnitTypeId } from "../main/engine/types";
import { validateSubmission } from "../main/engine/validation";
import { faction, move, spain, territory } from "./support";

const scenario = spain();
const state = initialGameState(scenario);
const planned: readonly Order[] = [
  move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha"),
  move("republic", "rep-covadonga-4", "madrid", "castilla-y-leon"),
  { factionId: faction("republic"), kind: "recruit", territoryId: territory("madrid"), unitTypeId: "infantry-regiment" as UnitTypeId }
];
const stream = (seed: number) => rollStream(seed, "blunder", 1, 0);

describe("computer-player blunders (H6)", () => {
  it("always replaces a unit's order at a chance of 1, with a legal alternative for the same unit", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const blundered = applyBlunders(scenario, state, planned, stream(seed), 1);
      const moves = blundered.filter(isMoveOrder);
      for (const order of moves) {
        const original = planned.filter(isMoveOrder).find((entry) => entry.unitId === order.unitId);
        expect(original).toBeDefined();
        expect(order.to).not.toBe(original?.to);
      }
      expect(validateSubmission(scenario, state, faction("republic"), { factionId: faction("republic"), orders: moves })).toEqual({ ok: true });
      expect(blundered.at(-1)).toBe(planned[2]);
    }
  });

  it("never blunders at a chance of 0, and then draws nothing", () => {
    const source = vi.fn(() => 0);
    expect(applyBlunders(scenario, state, planned, source, 0)).toBe(planned);
    expect(applyBlunders(scenario, state, planned, undefined, 1)).toBe(planned);
    expect(source).not.toHaveBeenCalled();
  });

  it("draws exactly once per planned order, and replays for a seed", () => {
    const source = vi.fn(seededRandom(9));
    applyBlunders(scenario, state, planned, source, 0.5);
    expect(source).toHaveBeenCalledTimes(planned.length);
    expect(applyBlunders(scenario, state, planned, stream(4), 0.5)).toEqual(applyBlunders(scenario, state, planned, stream(4), 0.5));
  });

  it("can fall back to the unit's default order, dropping the move", () => {
    const dropped = Array.from({ length: 40 }, (_, seed) => applyBlunders(scenario, state, planned, stream(seed), 1))
      .some((orders) => orders.filter(isMoveOrder).length < 2);
    expect(dropped).toBe(true);
  });

  it("plays a whole submission with the scenario's chance, from the blunder stream only", () => {
    const certain: Scenario = { ...scenario, ai: { ...scenario.ai, blunderChance: 1 } };
    const careful = generateComputerSubmission(scenario, state, faction("north"), seededRandom(3));
    const clumsy = generateComputerSubmission(certain, state, faction("north"), seededRandom(3), { blunder: stream(3) });
    expect(clumsy.orders).not.toEqual(careful.orders);
    expect(generateComputerSubmission(certain, state, faction("north"), seededRandom(3), { blunder: stream(3) })).toEqual(clumsy);
    expect(validateSubmission(certain, state, faction("north"), clumsy)).toEqual({ ok: true });
  });
});
