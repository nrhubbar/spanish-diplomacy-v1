import { describe, expect, it } from "vitest";
import { assess, victoryAlarm } from "../main/ai/assessment";
import { generateComputerSubmission } from "../main/ai/computerPlayer";
import { stalledTurns } from "../main/ai/memory";
import { chooseOffensive, offensiveWeights, prizeFactor } from "../main/ai/offensive";
import { estimateAttack } from "../main/engine/combat";
import { seededRandom } from "../main/engine/random";
import type { GameState, TurnOutcome } from "../main/engine/types";
import { board, demoralize, into, ordersOf, type Placement } from "./aiBoards";
import { faction, move, spain, territory, tiny, unit, withUnits } from "./support";

// The South holds everything but Valencia; its objectives are all held, so only an offensive
// gives its armies a direction. One regiment holds Valencia.
const valencia: Placement = [
  ["south-regulares", "south", "andalucia"],
  ["south-lepanto-5", "south", "andalucia"],
  ["south-granada-6", "south", "andalucia"],
  ["rep-otumba-9", "republic", "valencia"]
];

describe("computer player: offensives (C18)", () => {
  it("chooses an offensive target it can reach through friendly ground", () => {
    const scenario = spain();
    const state = board(scenario, "south", ["valencia"], [...valencia, ["south-legion", "south", "murcia"]]);
    const ready = Object.values(state.units).filter((army) => army.factionId === "south");
    const offensive = chooseOffensive(scenario, state, assess(scenario, state, faction("south")), ready);
    expect(offensive?.target).toBe("valencia");
    expect(offensive?.distance.get(territory("andalucia"))).toBe(2);
    expect(offensive?.massedTakeChance).toBeGreaterThan(0);
  });

  it("stages spare armies toward the target before the odds are good", () => {
    const scenario = spain();
    const state = board(scenario, "south", ["valencia"], [
      ...valencia,
      ["rep-guadalajara-10", "republic", "valencia"],
      ["south-legion", "south", "murcia"]
    ]);
    const orders = ordersOf(scenario, state, "south");
    expect(into(orders, "valencia")).toEqual([]);
    // Murcia and Castilla-La Mancha both border Valencia.
    const staged = orders.filter((order) => order.from === "andalucia" && ["murcia", "castilla-la-mancha"].includes(order.to));
    expect(staged.length).toBeGreaterThan(0);
    // The last army on an objective stays.
    expect(staged.length).toBeLessThan(3);
  });

  it("attacks once the massed armies have the odds", () => {
    const scenario = spain();
    const massed = board(scenario, "south", ["valencia"], [
      ...valencia,
      ["south-legion", "south", "murcia"],
      ["south-legion-1", "south", "murcia"],
      ["south-africa-vanguard", "south", "murcia"]
    ]);
    const attackers = into(ordersOf(scenario, massed, "south"), "valencia");
    const estimate = estimateAttack(scenario, massed, faction("south"), attackers.map(unit), territory("valencia"));
    expect(estimate.kind === "battle" && estimate.takeChance).toBeGreaterThanOrEqual(0.5);
  });

  it("accepts worse odds after turns without a gain (stall pressure)", () => {
    const scenario = spain();
    // Two colonial counters against a militia column dug in at +3 in Ceuta: 3:1 with three off
    // the roll, one chance in six. Andalucia's demoralized regiments hold it meanwhile.
    const base = demoralize(board(scenario, "south", ["ceuta"], [
      ["south-legion", "south", "andalucia"],
      ["south-regulares", "south", "andalucia"],
      ["south-lepanto-5", "south", "andalucia"],
      ["south-granada-6", "south", "andalucia"],
      ["rep-madrid-sierra-column", "republic", "ceuta"]
    ], ["ceuta"]), ["south-lepanto-5", "south-granada-6"]);
    // Every city is the South's too, so no rival is near victory (no alarm).
    const cityControl = Object.fromEntries(scenario.cities.map((entry) => [entry.id, faction("south")]));
    const state: GameState = { ...base, cityControl, fortification: { [territory("ceuta")]: { factionId: faction("republic"), level: 3 } } };
    expect(ordersOf(scenario, state, "south")).toEqual([]);
    const quiet: readonly (readonly TurnOutcome[])[] = [[], [], [], []];
    const pressed = generateComputerSubmission(scenario, state, faction("south"), seededRandom(1), { history: quiet });
    const attackers = into(pressed.orders, "ceuta");
    expect(attackers).toEqual(["south-legion", "south-regulares"]);
    const estimate = estimateAttack(scenario, state, faction("south"), attackers.map(unit), territory("ceuta"));
    expect(estimate.kind === "battle" && estimate.takeChance).toBe(1 / 6);
  });

  it("counts turns without a gain, and raises the prize for the target and for a stall", () => {
    const gain: TurnOutcome = { kind: "successful-move", order: move("south", "south-legion", "murcia", "valencia") };
    expect(stalledTurns([[gain], [], []], faction("south"))).toBe(2);
    expect(stalledTurns([[], [gain]], faction("south"))).toBe(0);
    expect(stalledTurns([[gain]], faction("north"))).toBe(1);
    const offensive = { distance: new Map(), massedTakeChance: 0.5, target: territory("valencia") };
    expect(prizeFactor(offensive, territory("valencia"), 0)).toBe(1 + offensiveWeights.focus);
    expect(prizeFactor(offensive, territory("murcia"), 99)).toBe(1 + offensiveWeights.stallStep * offensiveWeights.stallCap);
    expect(prizeFactor(undefined, territory("murcia"), 1)).toBe(1 + offensiveWeights.stallStep);
  });
});

describe("computer player: relief and victory alarm", () => {
  it("does not walk into an empty territory its owner can relieve in strength", () => {
    const scenario = spain();
    const south: Placement = [["south-lepanto-5", "south", "andalucia"], ["south-granada-6", "south", "andalucia"]];
    const open = board(scenario, "south", ["murcia", "valencia"], south);
    expect(into(ordersOf(scenario, open, "south"), "murcia")).toHaveLength(1);
    const relieved = board(scenario, "south", ["murcia", "valencia"], [
      ...south,
      ["rep-otumba-9", "republic", "valencia"],
      ["rep-guadalajara-10", "republic", "valencia"]
    ]);
    expect(assess(scenario, relieved, faction("south")).relief(territory("murcia"))).toEqual({ defence: 12, factionId: "republic" });
    expect(into(ordersOf(scenario, relieved, "south"), "murcia")).toEqual([]);
  });

  it("raises the stakes of its own territory as a rival nears victory", () => {
    const scenario = tiny();
    // Red holds two of the three territories it needs.
    const state = withUnits(scenario, [["blue-marines", "blue", "harbor"]]);
    const view = assess(scenario, state, faction("blue"));
    const alarm = (victoryAlarm.steps - 1) * victoryAlarm.perStep;
    expect(view.stake(territory("lowlands"))).toBe(4 * (1 + alarm));
    expect(view.stake(territory("isle"))).toBe(4);
    expect(view.relief(territory("lowlands"))).toBeUndefined();
  });
});
