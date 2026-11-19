import { afterEach, describe, expect, it, vi } from "vitest";
import { assess, stakeWeights, victoryAlarm } from "../main/ai/assessment";
import { bouncedMoves, moveKey } from "../main/ai/memory";
import { expectedLosses } from "../main/ai/attacks";
import { computerWeights, generateComputerSubmission, legalMoves } from "../main/ai/computerPlayer";
import { battleOdds, estimateAttack } from "../main/engine/combat";
import { deriveSeed, seededRandom } from "../main/engine/random";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type { GameState, PlayerSubmission } from "../main/engine/types";
import { validateSubmission } from "../main/engine/validation";
import { board, demoralize, into, ordersOf, type Placement } from "./aiBoards";
import { armyIn, faction, loadedDice, spain, territory, tiny, unit, withUnits } from "./support";

describe("computer player: orders (C18)", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("submits valid, seed-deterministic orders for every faction", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    for (const entry of scenario.factions) {
      const first = generateComputerSubmission(scenario, state, entry.id, seededRandom(7));
      expect(generateComputerSubmission(scenario, state, entry.id, seededRandom(7))).toEqual(first);
      expect(validateSubmission(scenario, state, entry.id, first)).toEqual({ ok: true });
      expect(first.orders.length).toBeGreaterThan(0);
    }
  });

  it("replays a whole game identically from one seed and never uses Math.random", () => {
    const scenario = spain();
    const spy = vi.spyOn(Math, "random");
    const play = (seed: number): readonly (readonly PlayerSubmission[])[] => {
      let state = initialGameState(scenario);
      const turns: (readonly PlayerSubmission[])[] = [];
      for (let turn = 1; turn <= 6; turn += 1) {
        const submissions = scenario.factions.map((entry, index) =>
          generateComputerSubmission(scenario, state, entry.id, seededRandom(deriveSeed(seed, turn, index))));
        turns.push(submissions);
        state = resolveTurn(scenario, state, submissions, seed).finalState;
      }
      return turns;
    };
    expect(play(21)).toEqual(play(21));
    expect(spy).not.toHaveBeenCalled();
  });

  it("enumerates legal moves along every connection, including the sea", () => {
    const scenario = tiny();
    const state = initialGameState(scenario);
    expect(legalMoves(scenario, state, armyIn(state, "blue-marines")).map((order) => order.to)).toEqual(["highlands", "lowlands", "isle"]);
    expect(deriveSeed(1, 2)).not.toBe(deriveSeed(1, 3));
  });

  it("keeps the last defender on a threatened objective (A1)", () => {
    const scenario = spain();
    const state = withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"], ["north-san-marcial-22", "north", "castilla-y-leon"]]);
    expect(ordersOf(scenario, state, "republic")).toEqual([]);
  });

  it("does not shuttle armies between objectives it already holds (A1)", () => {
    const scenario = spain();
    const orders = ordersOf(scenario, initialGameState(scenario), "republic", 3);
    const shuttles = orders.filter((order) => ["valencia", "catalunya"].includes(order.from) && ["valencia", "catalunya"].includes(order.to));
    expect(shuttles).toEqual([]);
  });

  it("takes an empty territory, and avoids repeating a move that bounced last turn (A2)", () => {
    const scenario = tiny();
    // The Red Guard stays home in Westfold, so the marines can leave the harbor.
    const state = withUnits(scenario, [["blue-marines", "blue", "harbor"], ["red-guard", "red", "westfold"]]);
    const fresh = ordersOf(scenario, state, "blue");
    expect(fresh).toHaveLength(1);
    const remembered = generateComputerSubmission(scenario, state, faction("blue"), seededRandom(1), {
      previousOutcomes: fresh.map((order) => ({ cause: { opposingFactionIds: [faction("red")], kind: "standoff" }, kind: "bounced-move", order }))
    });
    expect(remembered.orders.map((order) => order.to)).not.toContain(fresh[0]?.to);
  });

  it("also remembers an attack that failed last turn, now a battle rather than a bounce (A2, M17)", () => {
    const scenario = tiny();
    // The Isle is Blue's, so the only attack open to the marines is the weakened Rangers.
    const base = withUnits(scenario, [["blue-marines", "blue", "harbor"], ["red-rangers", "red", "highlands"]]);
    const state: GameState = {
      ...base,
      control: { ...base.control, [territory("isle")]: { factionId: faction("blue"), kind: "controlled" } },
      units: { ...base.units, [unit("red-rangers")]: { ...armyIn(base, "red-rangers"), strength: 150 } }
    };
    const fresh = generateComputerSubmission(scenario, state, faction("blue"), seededRandom(1));
    expect(fresh.orders.map((order) => order.to)).toEqual(["highlands"]);
    const failed = resolveTurn(scenario, state, [fresh], 1, loadedDice([1]));
    expect(failed.outcomes.find((outcome) => outcome.kind === "battle")).toMatchObject({ site: { kind: "assault", occupation: { kind: "held" } } });
    // The failed assault is remembered and costs the same move a penalty next turn. Red is one
    // territory from victory, so retaking the Highlands still outweighs it here.
    expect(bouncedMoves(failed.outcomes, faction("blue")).has(moveKey(unit("blue-marines"), territory("harbor"), territory("highlands")))).toBe(true);
    expect(bouncedMoves(failed.outcomes, faction("red")).size).toBe(0);
  });
});

describe("computer player: attacks (C18)", () => {
  it("attacks where the odds are good, not where the defence is strong", () => {
    const scenario = spain();
    // From Andalucia, Ceuta holds one militia column and Melilla two regiments.
    const state = board(scenario, "south", ["ceuta", "melilla"], [
      ["south-legion", "south", "andalucia"],
      ["south-regulares", "south", "andalucia"],
      ["south-lepanto-5", "south", "andalucia"],
      ["south-granada-6", "south", "andalucia"],
      ["rep-madrid-sierra-column", "republic", "ceuta"],
      ["rep-wad-ras-1", "republic", "melilla"],
      ["rep-covadonga-4", "republic", "melilla"]
    ], ["ceuta", "melilla"]);
    const orders = ordersOf(scenario, state, "south");
    const attackers = into(orders, "ceuta");
    expect(attackers.length).toBeGreaterThan(0);
    expect(into(orders, "melilla")).toEqual([]);
    const estimate = estimateAttack(scenario, state, faction("south"), attackers.map(unit), territory("ceuta"));
    expect(estimate.kind === "battle" && estimate.takeChance).toBeGreaterThan(0.5);
  });

  it("does not attack at hopeless odds", () => {
    const scenario = spain();
    const state = board(scenario, "north", ["madrid"], [
      ["north-la-victoria-28", "north", "castilla-y-leon"],
      ["rep-wad-ras-1", "republic", "madrid"],
      ["rep-covadonga-4", "republic", "madrid"],
      ["rep-madrid-security", "republic", "madrid"],
      ["rep-madrid-sierra-column", "republic", "madrid"]
    ]);
    expect(ordersOf(scenario, state, "north")).toEqual([]);
  });

  it("combines armies from several origins when that improves the odds", () => {
    const scenario = spain();
    // Madrid borders only Castilla y Leon and Castilla-La Mancha; each holds two regiments.
    // One regiment against Madrid's militia column has poor odds; one from each does better.
    const state = board(scenario, "north", ["madrid"], [
      ["north-san-marcial-22", "north", "castilla-y-leon"],
      ["north-zamora-29", "north", "castilla-y-leon"],
      ["north-san-quintin-25", "north", "castilla-la-mancha"],
      ["north-la-victoria-28", "north", "castilla-la-mancha"],
      ["rep-madrid-sierra-column", "republic", "madrid"]
    ]);
    const attackers = into(ordersOf(scenario, state, "north"), "madrid");
    expect(new Set(attackers.map((id) => armyIn(state, id).territoryId)).size).toBe(2);
    const combined = estimateAttack(scenario, state, faction("north"), attackers.map(unit), territory("madrid"));
    if (combined.kind !== "battle") throw new Error("expected a battle");
    for (const id of attackers) {
      const alone = estimateAttack(scenario, state, faction("north"), [unit(id)], territory("madrid"));
      expect(alone.kind === "battle" && alone.takeChance).toBeLessThan(combined.takeChance);
    }
  });

  it("weighs the expected losses of every result", () => {
    const odds = battleOdds(spain().combat, 12, 6, []);
    // 2:1 with no modifiers: rolls 1-6 give AD, BD, BD, DD, DX, DE.
    const losses = expectedLosses(odds, 0.5);
    expect(losses.attacker).toBeCloseTo((1 / 6) * 6 + (3 / 6) * 12 * 0.5);
    expect(losses.defender).toBeCloseTo((2 / 6) * 6 + (3 / 6) * 6 * 0.5);
    const hopeless = expectedLosses(battleOdds(spain().combat, 1, 8, []), 0);
    expect(hopeless.attacker).toBeCloseTo((4 / 6) * 1 + (1 / 6) * 1);
  });
});

describe("computer player: defence and morale (C18, M23)", () => {
  it("reinforces a threatened territory it controls, and only when it is threatened", () => {
    const scenario = spain();
    const placement: Placement = [
      ["rep-sevilla-34", "republic", "castilla-la-mancha"],
      ["rep-otumba-9", "republic", "valencia"],
      ["rep-guadalajara-10", "republic", "valencia"],
      ["rep-castilla-3", "republic", "valencia"],
      ["south-legion", "south", "andalucia"],
      ["south-regulares", "south", "andalucia"]
    ];
    const threatened = board(scenario, "republic", ["andalucia"], placement);
    const reinforcements = ordersOf(scenario, threatened, "republic").filter((order) => order.to === "castilla-la-mancha");
    expect(reinforcements.length).toBeGreaterThan(0);
    expect(reinforcements.every((order) => order.from === "valencia")).toBe(true);
    // Demoralized, the same armies cannot attack (M23): one regiment holds Castilla-La Mancha.
    const quiet = demoralize(threatened, ["south-legion", "south-regulares"]);
    expect(into(ordersOf(scenario, quiet, "republic"), "castilla-la-mancha")).toEqual([]);
  });

  it("defends a threatened objective before taking a lesser free territory", () => {
    const scenario = spain();
    // Catalunya stands empty with a regiment next door in Aragon; the Balearics are empty and
    // free to take. Either needs an army from Valencia, and one of the two must stay there.
    const state = board(scenario, "republic", ["aragon", "islas-baleares"], [
      ["rep-otumba-9", "republic", "valencia"],
      ["rep-guadalajara-10", "republic", "valencia"],
      ["north-aragon-17", "north", "aragon"]
    ]);
    const orders = ordersOf(scenario, state, "republic");
    expect(into(orders, "catalunya")).toHaveLength(1);
    expect(into(orders, "islas-baleares")).toEqual([]);
  });

  it("never orders a demoralized army, and attacks with the others", () => {
    const scenario = spain();
    const placement: Placement = [
      ["north-san-marcial-22", "north", "castilla-y-leon"],
      ["north-san-quintin-25", "north", "castilla-y-leon"],
      ["north-la-victoria-28", "north", "castilla-y-leon"],
      ["north-zamora-29", "north", "castilla-y-leon"],
      ["rep-madrid-sierra-column", "republic", "madrid"]
    ];
    const start = board(scenario, "north", ["madrid"], placement);
    expect(into(ordersOf(scenario, start, "north"), "madrid").length).toBeGreaterThan(0);

    const allDown = demoralize(start, ["north-san-marcial-22", "north-san-quintin-25", "north-la-victoria-28", "north-zamora-29"]);
    expect(ordersOf(scenario, allDown, "north")).toEqual([]);

    const someDown = demoralize(start, ["north-san-marcial-22", "north-san-quintin-25"]);
    const ordered = ordersOf(scenario, someDown, "north").map((order) => order.unitId);
    expect(ordered.length).toBeGreaterThan(0);
    expect(ordered).not.toContain("north-san-marcial-22");
    expect(ordered).not.toContain("north-san-quintin-25");
  });

  it("counts demoralized hostile armies only as able to walk into empty ground", () => {
    const scenario = spain();
    const state = demoralize(withUnits(scenario, [
      ["rep-wad-ras-1", "republic", "madrid"],
      ["north-san-marcial-22", "north", "castilla-y-leon"]
    ]), ["north-san-marcial-22"]);
    const view = assess(scenario, state, faction("republic"));
    expect(view.danger(territory("madrid"), 6)).toBe(0);
    expect(view.danger(territory("madrid"), 0)).toBe(1);
    expect(view.danger(territory("catalunya"), 0)).toBe(0);
    const alert = assess(scenario, withUnits(scenario, [["north-san-marcial-22", "north", "castilla-y-leon"]]), faction("republic"));
    expect(alert.danger(territory("madrid"), 1)).toBeGreaterThan(0);
  });

  it("values territories by victory weight, cities, and objectives", () => {
    const scenario = spain();
    const view = assess(scenario, initialGameState(scenario), faction("south"));
    expect(view.stake(territory("andalucia"))).toBe(stakeWeights.territory + 5 * stakeWeights.city + stakeWeights.objective);
    // The Republic starts three territories short of victory, which raises the South's own stakes.
    expect(view.stake(territory("ceuta"))).toBe(stakeWeights.territory * (1 + victoryAlarm.perStep));
    expect(view.isObjective(territory("madrid"))).toBe(true);
    expect(computerWeights.ownLoss).toBeGreaterThan(computerWeights.enemyLoss);
  });
});
