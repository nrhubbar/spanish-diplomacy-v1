import { describe, expect, it } from "vitest";
import {
  armyValue,
  battleOdds,
  battleSide,
  estimateAttack,
  faceFor,
  isSuccessful,
  oddsFor,
  oddsModifiers,
  rollModifier,
  situationalModifiers,
  successfulResults,
  tableResult,
  tableRow
} from "../main/engine/combat";
import { initialGameState } from "../main/engine/resolution";
import { type BattleResult, battleResults, type CombatModifier, type GameState, type Scenario, type UnitState } from "../main/engine/types";
import { outcomeKeys, resultKeys, statusKeys } from "../main/presentation/outcomes";
import { battleResultSchema } from "../main/scenarios/schema/scenarioSchema";
import { armyIn, city, faction, spain, territory, tiny, unit } from "./support";

/** The corrected results sequence: column k of the table is SEQ.slice(k, k + 7). */
const SEQ: readonly BattleResult[] = [
  "attacker-eliminated", "attacker-eliminated", "attacker-attrition", "attacker-demoralized",
  "both-demoralized", "both-demoralized", "defender-demoralized", "defender-exchange",
  "defender-eliminated", "defender-eliminated", "defender-eliminated", "defender-eliminated", "defender-eliminated"
];
const correctedTable = [0, 1, 2, 3, 4, 5, 6].map((column) => SEQ.slice(column, column + 7));

const morale = (demoralized: boolean) => ({ demoralized, quietTurns: 0 });

/** One army of the fixture with its strength and morale overridden. */
function army(state: GameState, id: string, strength: number, demoralized = false): UnitState {
  return { ...armyIn(state, id), morale: morale(demoralized), strength };
}

function withArmy(state: GameState, changed: UnitState): GameState {
  return { ...state, units: { ...state.units, [changed.id]: changed } };
}

describe("results table (M15, C2)", () => {
  it("ships the corrected table in every package", () => {
    expect(spain().combat.table).toEqual(correctedTable);
    expect(tiny().combat.table).toEqual(correctedTable);
  });

  it("makes each odds step exactly one result better for the attacker", () => {
    for (let column = 1; column < correctedTable.length; column += 1) {
      expect(correctedTable[column]?.slice(0, 6)).toEqual(correctedTable[column - 1]?.slice(1));
    }
  });

  it("reads the table by column and modified roll", () => {
    const { combat } = spain();
    expect(tableResult(combat, 0, 0)).toBe("attacker-eliminated");
    expect(tableResult(combat, 2, 1)).toBe("attacker-demoralized");
    expect(tableResult(combat, 6, 6)).toBe("defender-eliminated");
    expect(() => tableResult(combat, 7, 0)).toThrow("no table entry at column 7");
    expect(() => tableResult(combat, 0, 7)).toThrow("row 7");
  });

  it("clamps the modified roll to rows 0 to 6", () => {
    expect(tableRow(1, 0)).toBe(1);
    expect(tableRow(1, -3)).toBe(0);
    expect(tableRow(6, 2)).toBe(6);
    expect(tableRow(4, -1)).toBe(3);
  });
});

describe("army and side values (M12, C4, C5, C6)", () => {
  const scenario = tiny();
  const state = initialGameState(scenario);

  it("scales the type value by strength over full strength", () => {
    expect(armyValue(scenario, army(state, "red-guard", 500), "attack")).toBe(4);
    expect(armyValue(scenario, army(state, "red-guard", 500), "defence")).toBe(5);
    expect(armyValue(scenario, armyIn(state, "red-rangers"), "attack")).toBe(3);
    expect(armyValue(scenario, armyIn(state, "red-rangers"), "defence")).toBe(4);
  });

  it("applies the demoralization factor, rounding once, halves up", () => {
    expect(armyValue(scenario, army(state, "red-guard", 500, true), "attack")).toBe(2);
    expect(armyValue(scenario, army(state, "red-guard", 500, true), "defence")).toBe(3);
    // 5 x 208 / 400 = 2.6 and 2.6 x 0.5 = 1.3: rounding once gives 1; rounding twice would give 2.
    expect(armyValue(scenario, army(state, "red-rangers", 208, true), "defence")).toBe(1);
  });

  it("never values an army below 1", () => {
    expect(armyValue(scenario, army(state, "red-guard", 1), "attack")).toBe(1);
    expect(armyValue(scenario, army(state, "red-guard", 1, true), "defence")).toBe(1);
  });

  it("values the Spain types at full strength", () => {
    const spainState = initialGameState(spain());
    const regiment = armyIn(spainState, "rep-wad-ras-1");
    const legion = armyIn(spainState, "south-legion");
    const militia = armyIn(spainState, "rep-asturian-militia");
    expect([armyValue(spain(), regiment, "attack"), armyValue(spain(), regiment, "defence")]).toEqual([4, 6]);
    expect([armyValue(spain(), legion, "attack"), armyValue(spain(), legion, "defence")]).toEqual([6, 5]);
    expect([armyValue(spain(), militia, "attack"), armyValue(spain(), militia, "defence")]).toEqual([3, 4]);
    expect(armyValue(spain(), { ...regiment, strength: regiment.strength / 2 }, "attack")).toBe(2);
  });

  it("sums the rounded army values, each army fighting from where it stands", () => {
    const side = battleSide(scenario, [army(state, "red-guard", 500, true), army(state, "red-rangers", 300, true)], "defence");
    // 2.5 rounds to 3 and 1.875 to 2: the side is 5, not the rounded sum of 4.375.
    expect(side).toEqual({
      armies: [
        { factionId: "red", from: "westfold", unitId: "red-guard", value: 3 },
        { factionId: "red", from: "highlands", unitId: "red-rangers", value: 2 }
      ],
      value: 5
    });
  });
});

describe("odds (M13, M14, C3)", () => {
  it.each([
    [1, 1, "1:1", 1, 0, 0],
    [5, 3, "1:1", 1, 0, 0],
    [8, 4, "2:1", 2, 0, 0],
    [11, 4, "2:1", 2, 0, 0],
    [12, 2, "6:1", 6, 0, 0],
    [13, 2, "6:1", 6, 0, 0],
    [7, 1, "7:1", 6, 0, 1],
    [16, 2, "8:1", 6, 0, 2],
    [2, 3, "1:2", 0, 1, 0],
    [1, 2, "1:2", 0, 1, 0],
    [1, 3, "1:3", 0, 1, 0],
    [2, 7, "1:4", 0, 2, 0],
    [1, 4, "1:4", 0, 2, 0],
    [1, 7, "1:7", 0, 2, 0],
    [1, 8, "1:8", 0, 3, 0]
  ])("rounds %i against %i in the defender's favour to %s", (attack, defence, label, column, halvings, overflow) => {
    expect(oddsFor(attack, defence)).toEqual({ column, halvings, label, overflow });
  });

  it("rejects side values that are not positive whole numbers", () => {
    expect(() => oddsFor(0, 3)).toThrow("attack value must be a positive whole number");
    expect(() => oddsFor(3, 0)).toThrow("defence value");
    expect(() => oddsFor(2.5, 1)).toThrow("not 2.5");
  });

  it("adds odds above 6:1 to the roll and takes the penalty for each halving below 1:1", () => {
    const { combat } = spain();
    expect(oddsModifiers(combat, oddsFor(16, 2))).toEqual([{ kind: "odds-overflow", roll: 2 }]);
    expect(oddsModifiers(combat, oddsFor(1, 4))).toEqual([{ halvings: 2, kind: "odds-halving", roll: -2 }]);
    expect(oddsModifiers(combat, oddsFor(3, 1))).toEqual([]);
    expect(oddsModifiers({ ...combat, belowOneToOne: { kind: "halving", rollPenalty: 0 } }, oddsFor(1, 4))).toEqual([]);
    expect(oddsModifiers({ ...combat, belowOneToOne: { kind: "halving", rollPenalty: 2 } }, oddsFor(1, 2))).toEqual([
      { halvings: 1, kind: "odds-halving", roll: -2 }
    ]);
  });

  it("sums modifiers into one roll change", () => {
    expect(rollModifier([])).toBe(0);
    expect(rollModifier([{ kind: "odds-overflow", roll: 2 }, { kind: "dug-in", level: 3, roll: -3 }])).toBe(-1);
  });
});

describe("outcome distribution (M15, M16)", () => {
  const { combat } = spain();

  it("gives 2:1 without modifiers a 50 percent chance to take", () => {
    const odds = battleOdds(combat, 8, 4, []);
    expect(odds.oddsLabel).toBe("2:1");
    expect(odds.faces.map((face) => face.result)).toEqual([
      "attacker-demoralized", "both-demoralized", "both-demoralized", "defender-demoralized", "defender-exchange", "defender-eliminated"
    ]);
    expect(odds.takeChance).toBe(0.5);
  });

  it("gives 3:1 against a fully dug-in defender one chance in six", () => {
    const odds = battleOdds(combat, 9, 3, [{ kind: "dug-in", level: 3, roll: -3 }]);
    expect(odds.faces.map((face) => face.row)).toEqual([0, 0, 0, 1, 2, 3]);
    expect(odds.rollModifier).toBe(-3);
    expect(odds.takeChance).toBe(1 / 6);
    expect(odds.chances["attacker-demoralized"]).toBeCloseTo(0.5);
  });

  it("reaches row 0 only with a negative modifier", () => {
    expect(battleOdds(combat, 4, 4, []).faces.map((face) => face.row)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(battleOdds(combat, 1, 4, []).faces.map((face) => face.row)).toEqual([0, 0, 1, 2, 3, 4]);
  });

  it("lists situational modifiers before the odds modifiers and sums every chance to 1", () => {
    const odds = battleOdds(combat, 16, 2, [{ kind: "dug-in", level: 1, roll: -1 }]);
    expect(odds.modifiers).toEqual([{ kind: "dug-in", level: 1, roll: -1 }, { kind: "odds-overflow", roll: 2 }]);
    expect(odds.rollModifier).toBe(1);
    expect(odds.column).toBe(6);
    expect(odds.takeChance).toBe(1);
    expect(Object.values(odds.chances).reduce((sum, chance) => sum + chance, 0)).toBeCloseTo(1);
    expect(Object.keys(odds.chances).sort()).toEqual([...battleResults].sort());
  });

  it("finds the face a die shows", () => {
    const odds = battleOdds(combat, 8, 4, []);
    expect(faceFor(odds, 6)).toEqual({ die: 6, result: "defender-eliminated", row: 6 });
    expect(() => faceFor(odds, 7)).toThrow("7 is not a face");
  });

  it("counts only defender-demoralized, exchange, and eliminated as success", () => {
    expect(battleResults.filter(isSuccessful)).toEqual([...successfulResults]);
  });
});

describe("situational modifiers (M14, M22, M24, C7, C17)", () => {
  const scenario = tiny();
  const start = initialGameState(scenario);
  const dug: GameState = { ...start, fortification: { [territory("harbor")]: { factionId: faction("blue"), level: 2 } } };
  const context = { attackerFactionId: faction("red"), defenderFactionIds: [faction("blue")], diggingIn: true, territoryId: territory("harbor") };
  const batteries: CombatModifier = { factionId: faction("blue"), kind: "faction", modifierId: "harbor-batteries", name: "Harbor batteries", role: "defence", roll: -1 };

  it("names the works and the faction modifier that help the defender", () => {
    expect(situationalModifiers(scenario, dug, context)).toEqual([{ kind: "dug-in", level: 2, roll: -2 }, batteries]);
  });

  it("gives no works bonus in battles without works or to another faction's defenders", () => {
    expect(situationalModifiers(scenario, dug, { ...context, diggingIn: false })).toEqual([batteries]);
    const redWorks: GameState = { ...dug, fortification: { [territory("harbor")]: { factionId: faction("red"), level: 2 } } };
    expect(situationalModifiers(scenario, redWorks, context)).toEqual([batteries]);
    const noWorks: GameState = { ...dug, fortification: { [territory("harbor")]: { factionId: faction("blue"), level: 0 } } };
    expect(situationalModifiers(scenario, noWorks, context)).toEqual([batteries]);
  });

  it("applies a faction modifier only while its faction controls a city in the territory", () => {
    const lost: GameState = { ...start, cityControl: { ...start.cityControl, [city("port-town")]: faction("red") } };
    expect(situationalModifiers(scenario, lost, context)).toEqual([]);
    expect(situationalModifiers(scenario, start, { ...context, territoryId: territory("lowlands") })).toEqual([]);
  });

  it("applies attack bonuses to the attacker and defence bonuses to the defender only", () => {
    const both: Scenario = {
      ...scenario,
      combat: {
        ...scenario.combat,
        factionModifiers: [{ attack: 2, defence: 1, factionId: faction("blue"), id: "both-ways", name: "Both ways", when: "holds-controlled-city" }]
      }
    };
    const attacking = { ...context, attackerFactionId: faction("blue"), defenderFactionIds: [faction("red")] };
    expect(situationalModifiers(both, start, attacking)).toEqual([
      { factionId: "blue", kind: "faction", modifierId: "both-ways", name: "Both ways", role: "attack", roll: 2 }
    ]);
    expect(situationalModifiers(both, start, context)).toEqual([
      { factionId: "blue", kind: "faction", modifierId: "both-ways", name: "Both ways", role: "defence", roll: -1 }
    ]);
  });

  it("loads popular resistance as a Republican defence modifier", () => {
    expect(spain().combat.factionModifiers).toEqual([
      { attack: 0, defence: 1, factionId: "republic", id: "popular-resistance", name: "Popular resistance", when: "holds-controlled-city" }
    ]);
    expect(spain().combat).toMatchObject({
      belowOneToOne: { kind: "halving", rollPenalty: 1 },
      demoralizationFactor: 0.5,
      diggingIn: { max: 3, perTurn: 1 }
    });
  });
});

describe("attack estimates (C15)", () => {
  const scenario = tiny();
  const start = initialGameState(scenario);

  it("calls a move into the mover's own territory a reinforcement", () => {
    expect(estimateAttack(scenario, start, faction("red"), [unit("red-rangers")], territory("westfold"))).toEqual({ kind: "reinforcement" });
    const shared = withArmy(start, { ...armyIn(start, "red-guard"), territoryId: territory("isle") });
    const marines = withArmy(shared, { ...armyIn(shared, "blue-marines"), territoryId: territory("isle") });
    expect(estimateAttack(scenario, marines, faction("red"), [unit("red-rangers")], territory("isle"))).toEqual({ kind: "reinforcement" });
  });

  it("calls a move into territory no other faction occupies unopposed", () => {
    expect(estimateAttack(scenario, start, faction("red"), [unit("red-rangers")], territory("lowlands"))).toEqual({ kind: "unopposed" });
    expect(estimateAttack(scenario, start, faction("red"), [unit("red-guard")], territory("isle"))).toEqual({ kind: "unopposed" });
  });

  it("estimates a battle from current strength, works, and faction modifiers", () => {
    const state: GameState = { ...start, fortification: { [territory("harbor")]: { factionId: faction("blue"), level: 1 } } };
    const estimate = estimateAttack(scenario, state, faction("red"), [unit("red-rangers"), unit("red-guard")], territory("harbor"));
    expect(estimate).toMatchObject({
      attack: 7,
      attacker: { value: 7 },
      column: 1,
      defence: 5,
      defender: { armies: [{ factionId: "blue", from: "harbor", unitId: "blue-marines", value: 5 }], value: 5 },
      kind: "battle",
      oddsLabel: "1:1",
      rollModifier: -2
    });
    if (estimate.kind !== "battle" || !("faces" in estimate)) throw new Error("expected a d6 battle");
    expect(estimate.modifiers.map((modifier) => modifier.kind)).toEqual(["dug-in", "faction"]);
    expect(estimate.faces.map((face) => face.row)).toEqual([0, 0, 1, 2, 3, 4]);
    expect(estimate.takeChance).toBe(0);
  });

  it("applies popular resistance and the halving penalty on the Spain map", () => {
    // Madrid held by its two regiments only, so three regiments attack at 1:1.
    const opening = initialGameState(spain());
    const regimentsOnly = Object.entries(opening.units).filter(([id]) => !["rep-madrid-security", "rep-madrid-sierra-column", "rep-general-miaja"].includes(id));
    const state = { ...opening, units: Object.fromEntries(regimentsOnly) };
    const attackers = [unit("north-san-marcial-22"), unit("north-san-quintin-25"), unit("north-argel-27")];
    const estimate = estimateAttack(spain(), state, faction("north"), attackers, territory("madrid"));
    if (estimate.kind !== "battle") throw new Error("expected a battle");
    expect([estimate.attack, estimate.defence, estimate.oddsLabel]).toEqual([12, 12, "1:1"]);
    expect(estimate.modifiers).toEqual([
      { factionId: "republic", kind: "faction", modifierId: "popular-resistance", name: "Popular resistance", role: "defence", roll: -1 }
    ]);
    expect(estimate.takeChance).toBe(1 / 6);
    const alone = estimateAttack(spain(), state, faction("north"), [unit("north-argel-27")], territory("madrid"));
    if (alone.kind !== "battle") throw new Error("expected a battle");
    expect(alone.oddsLabel).toBe("1:3");
    expect(alone.modifiers.map((modifier) => modifier.roll)).toEqual([-1, -1]);
    expect(alone.takeChance).toBe(0);
  });

  it("refuses an attack with no armies or with another faction's armies", () => {
    expect(() => estimateAttack(scenario, start, faction("red"), [], territory("harbor"))).toThrow("one or more armies");
    expect(() => estimateAttack(scenario, start, faction("red"), [unit("blue-marines")], territory("lowlands"))).toThrow("one or more armies");
    expect(() => estimateAttack(scenario, start, faction("red"), [unit("ghost")], territory("harbor"))).toThrow("unknown army in play");
  });
});

describe("outcome keys (section 2.1)", () => {
  it("keeps one list of results across the engine, the schema, and the presentation", () => {
    expect(battleResultSchema.options).toEqual([...battleResults]);
    expect(resultKeys).toEqual([
      "attacker-eliminated", "attacker-attrition", "attacker-demoralized", "both-demoralized",
      "defender-demoralized", "defender-exchange", "defender-eliminated"
    ]);
  });

  it("lists the five statuses and twelve distinct keys", () => {
    expect(statusKeys).toEqual(["demoralized", "dug-in", "recovered", "reinforcement-arrived", "surrendered"]);
    expect(new Set(outcomeKeys).size).toBe(12);
  });
});
