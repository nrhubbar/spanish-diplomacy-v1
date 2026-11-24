import { describe, expect, it } from "vitest";
import { estimateAttack } from "../main/engine/combat";
import { gradeAt, scoreFor } from "../main/engine/d20/odds";
import { d20Faces } from "../main/engine/d20/rules";
import type { BattleOutcome, GameState, Scenario, TurnOutcome, TurnResolutionResult } from "../main/engine/types";
import {
  type ArmySpec,
  battlefield,
  battlesOf,
  faction,
  loadedDice,
  move,
  play,
  spainM2,
  territory,
  tiny,
  unit,
  unitType
} from "./support";

// One group per battle rule (project/specs/scenario-package.md).
// Tiny-front armies are "foot" (attack 4, defence 5) with 100 men unless stated; Spain armies
// are infantry regiments (attack 4, defence 6). Every die is pinned with loaded dice.

const a = (id: string, factionId: string, where: string, extra: Partial<ArmySpec> = {}): ArmySpec => ({ faction: factionId, id, territory: where, ...extra });
const at = (result: TurnResolutionResult, id: string) => result.finalState.units[unit(id)]?.territoryId;
const armyOf = (result: TurnResolutionResult, id: string) => result.finalState.units[unit(id)];
const only = (result: TurnResolutionResult): BattleOutcome => {
  const [battle, ...rest] = battlesOf(result);
  if (battle === undefined || rest.length > 0) throw new Error(`Expected one battle, got ${String(battlesOf(result).length)}.`);
  return battle;
};
const outcomeOf = (result: TurnResolutionResult, id: string): TurnOutcome | undefined =>
  result.outcomes.find((outcome) => "order" in outcome && "unitId" in outcome.order && outcome.order.unitId === unit(id));
const lowlandsContested = (state: Partial<GameState> = {}): Partial<GameState> => ({
  control: { ...initialControl(tiny()), [territory("lowlands")]: { factionIds: [faction("red"), faction("blue")], kind: "contested" } },
  ...state
});

function initialControl(scenario: Scenario): GameState["control"] {
  return Object.fromEntries(scenario.territories.map((definition) => [definition.id, definition.initialControl]));
}

describe("M11 reinforcement (C10)", () => {
  it("always arrives in its faction's territory and joins its defence against an attack that turn", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "westfold"), a("b1", "blue", "harbor")]);
    const result = play(scenario, state, [move("red", "r1", "westfold", "highlands"), move("blue", "b1", "harbor", "highlands")], loadedDice([2]));
    expect(outcomeOf(result, "r1")).toEqual({ kind: "reinforcement-arrived", order: move("red", "r1", "westfold", "highlands") });
    expect(outcomeOf(result, "b1")).toBeUndefined();
    const battle = only(result);
    expect(battle).toMatchObject({
      attacker: { armies: [expect.objectContaining({ factionId: "blue", from: "harbor", unitId: "b1", value: 4 })], value: 4 },
      attackerFactionId: "blue",
      column: 0,
      defender: { armies: [expect.objectContaining({ factionId: "red", from: "westfold", unitId: "r1", value: 5 })], value: 5 },
      die: 2,
      losses: [{ destroyed: true, men: 100, unitId: "b1" }],
      modifiers: [{ halvings: 1, kind: "odds-halving", roll: -3 }],
      oddsLabel: "1:2",
      grade: "attacker-destroyed",
      score: 0,
      site: { kind: "assault", occupation: { kind: "held" }, territoryId: "highlands" }
    });
    expect(at(result, "r1")).toBe("highlands");
    expect(armyOf(result, "b1")).toBeUndefined();
  });

  it("never meets an enemy on the road: a reinforcement passes a hostile move head-on", () => {
    const { scenario, state } = battlefield(tiny(), [a("r0", "red", "harbor"), a("r1", "red", "highlands"), a("b0", "blue", "harbor")]);
    const result = play(scenario, state, [move("red", "r1", "highlands", "harbor"), move("blue", "b0", "harbor", "highlands")]);
    expect(outcomeOf(result, "r1")?.kind).toBe("reinforcement-arrived");
    expect(outcomeOf(result, "b0")?.kind).toBe("successful-move");
    expect(battlesOf(result)).toEqual([]);
    expect([at(result, "r0"), at(result, "r1"), at(result, "b0")]).toEqual(["harbor", "harbor", "highlands"]);
    expect(result.finalState.control[territory("harbor")]).toEqual({ factionId: "red", kind: "controlled" });
  });

  it("keys on friendly armies that stay: without one, the move into a shared territory attacks (OD-7)", () => {
    const { scenario, state } = battlefield(tiny(), [a("r0", "red", "harbor"), a("r1", "red", "highlands"), a("b0", "blue", "harbor")]);
    const result = play(scenario, state, [move("red", "r0", "harbor", "isle"), move("red", "r1", "highlands", "harbor")], loadedDice([2]));
    expect(outcomeOf(result, "r0")?.kind).toBe("successful-move");
    expect(only(result)).toMatchObject({ attackerFactionId: "red", grade: "attacker-destroyed", site: { kind: "assault", territoryId: "harbor" } });
  });

  it("does not count an army disbanded for an impossible order as staying (M9)", () => {
    const { scenario, state } = battlefield(tiny(), [a("r0", "red", "harbor"), a("r1", "red", "highlands"), a("b0", "blue", "harbor")]);
    const result = play(scenario, state, [move("red", "r0", "harbor", "westfold"), move("red", "r1", "highlands", "harbor")], loadedDice([2]));
    expect(outcomeOf(result, "r0")?.kind).toBe("invalid-order");
    expect(outcomeOf(result, "r1")).toBeUndefined();
    expect(only(result)).toMatchObject({ attackerFactionId: "red", site: { kind: "assault", territoryId: "harbor" } });
  });
});

describe("M12 values (C4, C5)", () => {
  it("combines one faction's armies from several origins into one side, each fighting from its origin", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "westfold"), a("r2", "red", "harbor"), a("b1", "blue", "lowlands")]);
    const result = play(scenario, state, [move("red", "r1", "westfold", "lowlands"), move("red", "r2", "harbor", "lowlands")], loadedDice([17]));
    const battle = only(result);
    expect(battle.attacker).toEqual({
      armies: [
        expect.objectContaining({ factionId: "red", from: "westfold", unitId: "r1", value: 4 }),
        expect.objectContaining({ factionId: "red", from: "harbor", unitId: "r2", value: 4 })
      ],
      value: 8
    });
    // 8 against 5 is 1:1; a 17 is a costly victory: Blue is destroyed and Red loses a fifth of each army.
    expect(battle).toMatchObject({ column: 1, oddsLabel: "1:1", grade: "costly-victory" });
    expect(battle.losses).toEqual([
      { destroyed: false, men: 20, unitId: "r1" },
      { destroyed: false, men: 20, unitId: "r2" },
      { destroyed: true, men: 100, unitId: "b1" }
    ]);
    expect(battle.site).toEqual({ kind: "assault", occupation: { factionId: "red", kind: "taken" }, territoryId: "lowlands" });
    expect(armyOf(result, "r2")).toMatchObject({ strength: 80, territoryId: "lowlands" });
    expect(result.finalState.control[territory("lowlands")]).toEqual({ factionId: "red", kind: "controlled" });
  });

  it("values a demoralized army at half, rounded halves up", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "westfold"), a("b1", "blue", "lowlands", { demoralized: true })]);
    const battle = only(play(scenario, state, [move("red", "r1", "westfold", "lowlands")], loadedDice([2])));
    expect(battle.defender.value).toBe(3);
    expect(battle.oddsLabel).toBe("1:1");
  });
});

describe("M13-M15 odds, modifiers, and the table (C2, C3)", () => {
  const types = [unitType("wall", 1, 6), ...[3, 6, 12, 18, 24, 30, 36].map((attack) => unitType(`a${String(attack)}`, attack, 1))];
  const columns = [["a3", "1:2"], ["a6", "1:1"], ["a12", "2:1"], ["a18", "3:1"], ["a24", "4:1"], ["a30", "5:1"], ["a36", "6:1"]] as const;

  it("resolves every column and die face to the table entry, as the estimate predicts", () => {
    for (const [column, [type, label]] of columns.entries()) {
      for (const die of d20Faces) {
        const { scenario, state } = battlefield(tiny(), [a("r1", "red", "westfold", { type }), a("b1", "blue", "lowlands", { type: "wall" })], { types });
        const battle = only(play(scenario, state, [move("red", "r1", "westfold", "lowlands")], loadedDice([die])));
        const score = scoreFor(die, column === 0 ? -3 : 0);
        expect([battle.column, battle.oddsLabel, battle.score, battle.grade]).toEqual([column, label, score, gradeAt(scenario.d20, column, score).id]);
        const estimate = estimateAttack(scenario, state, faction("red"), [unit("r1")], territory("lowlands"));
        if (estimate.kind !== "battle") throw new Error("Expected a battle estimate.");
        expect(estimate.bands.find((band) => band.from <= score && score <= band.to)?.gradeId).toBe(battle.grade);
      }
    }
  });

  it("adds odds above 6:1 to the roll", () => {
    // 36 + 12 against 6 is 8:1: column 6, and the two steps beyond it add 3 each to the roll.
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "westfold", { type: "a36" }), a("r2", "red", "westfold", { type: "a12" }), a("b1", "blue", "lowlands", { type: "wall" })], { types });
    const battle = only(play(scenario, state, [move("red", "r1", "westfold", "lowlands"), move("red", "r2", "westfold", "lowlands")], loadedDice([2])));
    expect(battle).toMatchObject({ column: 6, die: 2, modifiers: [{ kind: "odds-overflow", roll: 6 }], oddsLabel: "8:1", grade: "defender-destroyed", score: 8 });
  });

  it("matches the attack estimate for every face, with works and a faction modifier (C15)", () => {
    const base = battlefield(tiny(), [a("r1", "red", "highlands"), a("r2", "red", "highlands"), a("b1", "blue", "harbor")]);
    const state: GameState = { ...base.state, fortification: { [territory("harbor")]: { factionId: faction("blue"), level: 2 } } };
    const estimate = estimateAttack(base.scenario, state, faction("red"), [unit("r1"), unit("r2")], territory("harbor"));
    if (estimate.kind !== "battle") throw new Error("Expected a battle estimate.");
    const rolled = new Map<string, number>();
    for (const die of d20Faces) {
      const battle = only(play(base.scenario, state, [move("red", "r1", "highlands", "harbor"), move("red", "r2", "highlands", "harbor")], loadedDice([die])));
      expect(battle.attacker).toEqual(estimate.attacker);
      expect(battle.defender).toEqual(estimate.defender);
      expect([battle.column, battle.oddsLabel, battle.modifiers, battle.score]).toEqual([estimate.column, estimate.oddsLabel, estimate.modifiers, scoreFor(die, estimate.rollModifier)]);
      rolled.set(battle.grade, (rolled.get(battle.grade) ?? 0) + 1 / d20Faces.length);
    }
    expect(rolled.size).toBe(estimate.chances.size);
    for (const [grade, chance] of estimate.chances) expect(rolled.get(grade)).toBeCloseTo(chance);
    expect(estimate.modifiers.map((modifier) => modifier.kind)).toEqual(["dug-in", "faction"]);
  });
});

describe("M16 results (C2a)", () => {
  // Red r1 (attack 4) from Westfold against Blue b1 in the Lowlands. At 60 men b1 defends at 3,
  // so the odds are 1:1 and the die reads the column directly.
  const setup = (blueMen = 60) => battlefield(tiny(), [a("r1", "red", "westfold"), a("b1", "blue", "lowlands", { strength: blueMen })]);
  const attack = (die: number, blueMen?: number) => {
    const { scenario, state } = setup(blueMen);
    return play(scenario, state, [move("red", "r1", "westfold", "lowlands")], loadedDice([die]));
  };

  it("attacker-destroyed destroys every attacking army", () => {
    const result = attack(2, 100);
    expect(only(result)).toMatchObject({ losses: [{ destroyed: true, men: 100, unitId: "r1" }], grade: "attacker-destroyed", site: { occupation: { kind: "held" } } });
    expect(armyOf(result, "r1")).toBeUndefined();
  });

  it("attack-checked costs the attackers a share of their men, and they return", () => {
    const result = attack(2);
    expect(only(result)).toMatchObject({ losses: [{ destroyed: false, men: 20, unitId: "r1" }], grade: "attack-checked" });
    expect(armyOf(result, "r1")).toMatchObject({ strength: 80, territoryId: "westfold" });
  });

  it("attacker-repulsed demoralizes the attackers, who return", () => {
    const result = attack(5);
    expect(only(result)).toMatchObject({ demoralizedUnitIds: ["r1"], losses: [], grade: "attacker-repulsed" });
    expect(armyOf(result, "r1")).toMatchObject({ morale: { demoralized: true, quietTurns: 0 }, territoryId: "westfold" });
  });

  it("stalemate demoralizes both; the defenders stay and the attackers return", () => {
    const result = attack(8);
    expect(only(result)).toMatchObject({ demoralizedUnitIds: ["r1", "b1"], grade: "stalemate", site: { occupation: { kind: "held" } } });
    expect([at(result, "r1"), at(result, "b1")]).toEqual(["westfold", "lowlands"]);
    expect(armyOf(result, "b1")?.morale.demoralized).toBe(true);
  });

  it("driven-out demoralizes the defenders and makes them retreat; the attackers claim", () => {
    const result = attack(14);
    expect(only(result)).toMatchObject({
      demoralizedUnitIds: ["b1"],
      grade: "driven-out",
      retreats: [{ from: "lowlands", to: "harbor", unitId: "b1" }],
      site: { occupation: { factionId: "red", kind: "taken" } }
    });
    expect([at(result, "r1"), at(result, "b1")]).toEqual(["lowlands", "harbor"]);
  });

  it("costly-victory destroys the defenders and costs the attackers men; the survivors claim", () => {
    const result = attack(17);
    expect(only(result)).toMatchObject({
      losses: [{ destroyed: false, men: 20, unitId: "r1" }, { destroyed: true, men: 60, unitId: "b1" }],
      grade: "costly-victory"
    });
    expect(armyOf(result, "r1")).toMatchObject({ strength: 80, territoryId: "lowlands" });
  });

  it("defender-destroyed destroys the defenders and the attackers claim", () => {
    const result = attack(17, 40);
    expect(only(result)).toMatchObject({ losses: [{ destroyed: true, men: 40, unitId: "b1" }], oddsLabel: "2:1", grade: "defender-destroyed" });
    expect(armyOf(result, "r1")).toMatchObject({ strength: 100, territoryId: "lowlands" });
  });

  it("leaves the territory empty when a costly victory breaks up every attacker too", () => {
    // r1 at 11 men loses a fifth, which leaves it under a tenth of its full strength: it breaks up.
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "westfold", { strength: 11 }), a("b1", "blue", "lowlands", { strength: 10 })]);
    const result = play(scenario, state, [move("red", "r1", "westfold", "lowlands")], loadedDice([17]));
    expect(only(result)).toMatchObject({
      losses: [{ destroyed: true, men: 11, unitId: "r1" }, { destroyed: true, men: 10, unitId: "b1" }],
      grade: "costly-victory",
      site: { occupation: { kind: "left-empty" } }
    });
    expect(Object.keys(result.finalState.units)).toEqual([]);
    expect(result.finalState.control[territory("lowlands")]).toEqual({ factionId: "blue", kind: "controlled" });
  });

  it("takes the same share of men from every army, and breaks up one left under a tenth of its full strength", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "westfold"), a("r2", "red", "westfold", { strength: 11 }), a("b1", "blue", "lowlands")]);
    const battle = only(play(scenario, state, [move("red", "r1", "westfold", "lowlands"), move("red", "r2", "westfold", "lowlands")], loadedDice([2])));
    expect(battle).toMatchObject({ losses: [{ destroyed: false, men: 20, unitId: "r1" }, { destroyed: true, men: 11, unitId: "r2" }], grade: "attack-checked" });
  });

  describe("demoralization targeting", () => {
    it("falls on the weakest armies first until they carry half the side's value, ties by scenario order", () => {
      // Blue defends at 5 + 2 + 3 = 10; Red attacks at 12, so 1:1, and an 8 demoralizes both.
      const { scenario, state } = battlefield(tiny(), [
        a("r1", "red", "westfold"), a("r2", "red", "westfold"), a("r3", "red", "westfold"),
        a("b1", "blue", "lowlands"), a("b2", "blue", "lowlands", { strength: 40 }), a("b3", "blue", "lowlands", { strength: 60 })
      ]);
      const orders = ["r1", "r2", "r3"].map((id) => move("red", id, "westfold", "lowlands"));
      const result = play(scenario, state, orders, loadedDice([8]));
      expect(only(result)).toMatchObject({ grade: "stalemate" });
      // Red: r1 then r2 reach 8 of 12. Blue: b2 (2) then b3 (3) reach 5 of 10.
      expect(only(result).demoralizedUnitIds).toEqual(["r1", "r2", "b2", "b3"]);
      expect(["r1", "r2", "r3", "b1", "b2", "b3"].map((id) => armyOf(result, id)?.morale.demoralized)).toEqual([true, true, false, false, true, true]);
    });

    it("breaks ties in value by fewer men first", () => {
      const { scenario, state } = battlefield(tiny(), [a("r2", "red", "westfold", { fullStrength: 200 }), a("r1", "red", "westfold"), a("b1", "blue", "lowlands", { strength: 60 })]);
      // 8 against 3 is 2:1; a 2 reads attacker-repulsed. r1 (100 men) carries half alone.
      const battle = only(play(scenario, state, [move("red", "r2", "westfold", "lowlands"), move("red", "r1", "westfold", "lowlands")], loadedDice([2])));
      expect(battle).toMatchObject({ demoralizedUnitIds: ["r1"], grade: "attacker-repulsed" });
    });
  });
});

describe("M17 and M18: several attackers against one snapshot (section 1.6)", () => {
  // North holds La Rioja with one regiment (defence 6, no cities, so no faction modifiers).
  // The Republic attacks from the Pais Vasco and the South from Castilla y Leon; battles are
  // indexed by attacking faction id: the Republic's is 0, the South's 1.
  const three = (republic: number, south: number) => battlefield(spainM2(), [
    a("n1", "north", "la-rioja", { type: "infantry-regiment" }),
    ...Array.from({ length: republic }, (_, index) => a(`r${String(index + 1)}`, "republic", "pais-vasco", { type: "infantry-regiment" })),
    ...Array.from({ length: south }, (_, index) => a(`s${String(index + 1)}`, "south", "castilla-y-leon", { type: "infantry-regiment" }))
  ]);
  const orders = (republic: number, south: number) => [
    ...Array.from({ length: republic }, (_, index) => move("republic", `r${String(index + 1)}`, "pais-vasco", "la-rioja")),
    ...Array.from({ length: south }, (_, index) => move("south", `s${String(index + 1)}`, "castilla-y-leon", "la-rioja"))
  ];

  it("fights each attacker separately; the claimant with the greatest attack left moves in, the other returns", () => {
    const { scenario, state } = three(2, 3);
    const result = play(scenario, state, orders(2, 3), loadedDice([17, 17]));
    const [republic, south] = battlesOf(result);
    // Republic 8 against 6 (1:1): a costly victory; South 12 against 6 (2:1) destroys.
    expect([republic?.attackerFactionId, republic?.grade, south?.attackerFactionId, south?.grade]).toEqual(["republic", "costly-victory", "south", "defender-destroyed"]);
    expect([republic?.defender.value, south?.defender.value]).toEqual([6, 6]);
    expect(republic?.losses).toEqual([{ destroyed: false, men: 20, unitId: "r1" }, { destroyed: false, men: 20, unitId: "r2" }, { destroyed: true, men: 100, unitId: "n1" }]);
    expect(south?.losses).toEqual([]);
    for (const battle of [republic, south]) expect(battle?.site).toEqual({ kind: "assault", occupation: { factionId: "south", kind: "taken" }, territoryId: "la-rioja" });
    // The Republic's survivor returns home without further loss.
    expect(armyOf(result, "r2")).toMatchObject({ strength: 80, territoryId: "pais-vasco" });
    expect(["s1", "s2", "s3"].map((id) => at(result, id))).toEqual(["la-rioja", "la-rioja", "la-rioja"]);
    expect(result.finalState.control[territory("la-rioja")]).toEqual({ factionId: "south", kind: "controlled" });
  });

  it("sends every claimant home and leaves the territory empty when the greatest attacks tie", () => {
    const { scenario, state } = three(3, 3);
    const result = play(scenario, state, orders(3, 3), loadedDice([17, 17]));
    expect(battlesOf(result).map((battle) => [battle.grade, battle.site])).toEqual([
      ["defender-destroyed", { kind: "assault", occupation: { kind: "left-empty" }, territoryId: "la-rioja" }],
      ["defender-destroyed", { kind: "assault", occupation: { kind: "left-empty" }, territoryId: "la-rioja" }]
    ]);
    expect(battlesOf(result)[1]?.losses).toEqual([]);
    expect([at(result, "r1"), at(result, "s1"), armyOf(result, "n1")]).toEqual(["pais-vasco", "castilla-y-leon", undefined]);
    expect(result.finalState.control[territory("la-rioja")]).toEqual({ factionId: "north", kind: "controlled" });
  });

  it("gives the defenders every result they receive, each battle reporting its own", () => {
    const { scenario, state } = three(3, 3);
    // Republic stalemate, South driven-out: the defender is demoralized by the
    // first and driven out by the second, to Navarra (empty, and first in scenario order).
    const result = play(scenario, state, orders(3, 3), loadedDice([8, 11]));
    const [republic, south] = battlesOf(result);
    expect([republic?.grade, south?.grade]).toEqual(["stalemate", "driven-out"]);
    expect(republic?.demoralizedUnitIds).toEqual(["r1", "r2", "n1"]);
    expect(south?.demoralizedUnitIds).toEqual(["n1"]);
    expect([republic?.retreats, south?.retreats]).toEqual([[], [{ from: "la-rioja", to: "navarra", unitId: "n1" }]]);
    expect(south?.defender.value).toBe(6);
    expect(armyOf(result, "n1")).toMatchObject({ morale: { demoralized: true }, territoryId: "navarra" });
    expect(at(result, "s1")).toBe("la-rioja");
  });

  it("lets the defenders hold when no attack succeeds", () => {
    const { scenario, state } = three(1, 1);
    const result = play(scenario, state, orders(1, 1), loadedDice([2, 5]));
    expect(battlesOf(result).map((battle) => battle.site)).toEqual([
      { kind: "assault", occupation: { kind: "held" }, territoryId: "la-rioja" },
      { kind: "assault", occupation: { kind: "held" }, territoryId: "la-rioja" }
    ]);
    expect(at(result, "n1")).toBe("la-rioja");
  });
});

describe("M19 entry battles in empty territory (section 1.6 step 3)", () => {
  it("makes the greatest entrant stand, defending with its attack and no works", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "westfold"), a("b1", "blue", "harbor"), a("b2", "blue", "harbor")], {
      state: lowlandsContested({ fortification: { [territory("lowlands")]: { factionId: faction("blue"), level: 2 } } })
    });
    const result = play(scenario, state, [move("red", "r1", "westfold", "lowlands"), move("blue", "b1", "harbor", "lowlands"), move("blue", "b2", "harbor", "lowlands")], loadedDice([2]));
    expect(only(result)).toMatchObject({
      attackerFactionId: "red",
      defender: { armies: [{ from: "harbor", unitId: "b1", value: 4 }, { from: "harbor", unitId: "b2", value: 4 }], value: 8 },
      modifiers: [{ kind: "odds-halving", roll: -3 }],
      grade: "attacker-destroyed",
      site: { kind: "entry", occupation: { factionId: "blue", kind: "taken" }, territoryId: "lowlands" }
    });
    expect([at(result, "b1"), at(result, "b2")]).toEqual(["lowlands", "lowlands"]);
    expect(result.finalState.control[territory("lowlands")]).toEqual({ factionId: "blue", kind: "controlled" });
  });

  it("bounces every entrant when the greatest attacks tie (empty-territory meeting)", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "westfold"), a("b1", "blue", "harbor")], { state: lowlandsContested() });
    const result = play(scenario, state, [move("red", "r1", "westfold", "lowlands"), move("blue", "b1", "harbor", "lowlands")]);
    expect(battlesOf(result)).toEqual([]);
    expect(outcomeOf(result, "r1")).toEqual({ cause: { kind: "standoff", opposingFactionIds: ["blue"] }, kind: "bounced-move", order: move("red", "r1", "westfold", "lowlands") });
    expect(outcomeOf(result, "b1")).toMatchObject({ cause: { kind: "standoff", opposingFactionIds: ["red"] }, kind: "bounced-move" });
    expect([at(result, "r1"), at(result, "b1")]).toEqual(["westfold", "harbor"]);
  });

  it("fights each other entrant separately against the territory's holder, which stands (C3), three factions at once", () => {
    const control = { ...initialControl(spainM2()), [territory("la-rioja")]: { factionIds: [faction("north"), faction("republic")], kind: "contested" as const } };
    const { scenario, state } = battlefield(spainM2(), [
      a("n1", "north", "navarra", { type: "infantry-regiment" }),
      a("r1", "republic", "pais-vasco", { type: "infantry-regiment" }),
      a("s1", "south", "castilla-y-leon", { type: "infantry-regiment" }),
      a("s2", "south", "castilla-y-leon", { type: "infantry-regiment" })
    ], { state: { control } });
    const result = play(scenario, state, [
      move("north", "n1", "navarra", "la-rioja"),
      move("republic", "r1", "pais-vasco", "la-rioja"),
      move("south", "s1", "castilla-y-leon", "la-rioja"),
      move("south", "s2", "castilla-y-leon", "la-rioja")
    ], loadedDice([2, 2]));
    expect(battlesOf(result).map((battle) => [battle.attackerFactionId, battle.defender.value, battle.grade])).toEqual([
      ["republic", 4, "attack-checked"],
      ["south", 4, "attacker-repulsed"]
    ]);
    expect(result.finalState.control[territory("la-rioja")]).toEqual({ factionId: "north", kind: "controlled" });
  });

  it("sends an ousted standing entrant back to its origin", () => {
    // A Red attack bonus where Red holds a city makes the lesser entrant's 17 a success.
    const base = battlefield(tiny(), [a("r1", "red", "highlands"), a("b1", "blue", "lowlands"), a("b2", "blue", "lowlands")], {
      state: { control: { ...initialControl(tiny()), [territory("westfold")]: { factionIds: [faction("red"), faction("blue")], kind: "contested" } } }
    });
    const scenario: Scenario = {
      ...base.scenario,
      d20: { ...base.scenario.d20, factionModifiers: [{ attack: 6, defence: 0, factionId: faction("red"), id: "elan", name: "Elan", when: "holds-controlled-city" }] }
    };
    const result = play(scenario, base.state, [move("red", "r1", "highlands", "westfold"), move("blue", "b1", "lowlands", "westfold"), move("blue", "b2", "lowlands", "westfold")], loadedDice([17]));
    expect(only(result)).toMatchObject({ grade: "driven-out", score: 20, site: { kind: "entry", occupation: { factionId: "red", kind: "taken" } } });
    expect(only(result).retreats).toEqual([]);
    expect([at(result, "r1"), at(result, "b1"), at(result, "b2")]).toEqual(["westfold", "lowlands", "lowlands"]);
  });
});

describe("M20 head-on meeting battles (C9)", () => {
  const works = { fortification: { [territory("harbor")]: { factionId: faction("blue"), level: 2 } } };

  it("lets the stronger side attack on the road, with no works or faction modifiers, and the winner continues", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "highlands"), a("r2", "red", "highlands"), a("b1", "blue", "harbor")], { state: works });
    const result = play(scenario, state, [move("red", "r1", "highlands", "harbor"), move("red", "r2", "highlands", "harbor"), move("blue", "b1", "harbor", "highlands")], loadedDice([17]));
    expect(only(result)).toMatchObject({
      attackerFactionId: "red",
      defender: { armies: [{ from: "harbor", unitId: "b1", value: 5 }] },
      modifiers: [],
      grade: "costly-victory",
      site: { between: ["highlands", "harbor"], kind: "meeting", winner: "red" }
    });
    // The winner walks into the Harbor, which nobody else holds.
    expect(outcomeOf(result, "r2")?.kind).toBe("successful-move");
    expect(armyOf(result, "r2")).toMatchObject({ strength: 80, territoryId: "harbor" });
    expect(result.finalState.control[territory("harbor")]).toEqual({ factionId: "red", kind: "controlled" });
  });

  it("bounces both sides without a battle when their attacks are equal", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "highlands"), a("b1", "blue", "harbor")]);
    const result = play(scenario, state, [move("red", "r1", "highlands", "harbor"), move("blue", "b1", "harbor", "highlands")]);
    expect(battlesOf(result)).toEqual([]);
    expect(outcomeOf(result, "r1")).toMatchObject({ cause: { kind: "head-on", opposingFactionIds: ["blue"] }, kind: "bounced-move" });
    expect(outcomeOf(result, "b1")).toMatchObject({ cause: { kind: "head-on", opposingFactionIds: ["red"] }, kind: "bounced-move" });
    expect([at(result, "r1"), at(result, "b1")]).toEqual(["highlands", "harbor"]);
  });

  it("sends the loser home to defend, where the winner attacks it again (head-on swap)", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "highlands"), a("r2", "red", "highlands"), a("b1", "blue", "harbor"), a("b2", "blue", "harbor")]);
    const result = play(scenario, state, [move("red", "r1", "highlands", "harbor"), move("red", "r2", "highlands", "harbor"), move("blue", "b1", "harbor", "highlands")], loadedDice([14, 2]));
    const [meeting, assault] = battlesOf(result);
    expect(meeting).toMatchObject({ demoralizedUnitIds: ["b1"], grade: "driven-out", site: { kind: "meeting", winner: "red" } });
    // At home b1 defends demoralized (3) beside b2 (5), with the Harbor batteries: 8 against 8, -3.
    expect(assault).toMatchObject({
      defender: { armies: [{ from: "harbor", unitId: "b1", value: 3 }, { from: "harbor", unitId: "b2", value: 5 }], value: 8 },
      modifiers: [{ kind: "faction", modifierId: "harbor-batteries", roll: -3 }],
      grade: "attacker-destroyed",
      site: { kind: "assault", occupation: { kind: "held" }, territoryId: "harbor" }
    });
    expect([armyOf(result, "r1"), at(result, "b1"), at(result, "b2")]).toEqual([undefined, "harbor", "harbor"]);
  });

  it("lets the defender win on an attacker result, and continue its own move", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "highlands"), a("r2", "red", "highlands"), a("b1", "blue", "harbor")]);
    const result = play(scenario, state, [move("red", "r1", "highlands", "harbor"), move("red", "r2", "highlands", "harbor"), move("blue", "b1", "harbor", "highlands")], loadedDice([5, 2]));
    const [meeting, assault] = battlesOf(result);
    expect(meeting).toMatchObject({ grade: "attacker-repulsed", site: { winner: "blue" } });
    // Blue presses on into the Highlands, where the Red pair now defends: r1, the weaker by
    // scenario order, carries half their value, so only it was demoralized (3 + 5).
    expect(meeting?.demoralizedUnitIds).toEqual(["r1"]);
    expect(assault).toMatchObject({ attackerFactionId: "blue", defender: { value: 8 }, site: { territoryId: "highlands" } });
  });

  it("bounces both on a stalemate, with no winner", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "highlands"), a("r2", "red", "highlands"), a("b1", "blue", "harbor")]);
    const result = play(scenario, state, [move("red", "r1", "highlands", "harbor"), move("red", "r2", "highlands", "harbor"), move("blue", "b1", "harbor", "highlands")], loadedDice([8]));
    expect(only(result).site).toEqual({ between: ["highlands", "harbor"], kind: "meeting" });
    expect([at(result, "r1"), at(result, "b1")]).toEqual(["highlands", "harbor"]);
    expect(only(result).demoralizedUnitIds).toEqual(["r1", "b1"]);
  });

  it("bounces every move without a battle when more than two factions meet on one road", () => {
    const { scenario, state } = battlefield(spainM2(), [
      a("r1", "republic", "madrid", { type: "infantry-regiment" }),
      a("s1", "south", "madrid", { type: "infantry-regiment" }),
      a("n1", "north", "castilla-y-leon", { type: "infantry-regiment" })
    ]);
    const result = play(scenario, state, [
      move("republic", "r1", "madrid", "castilla-y-leon"),
      move("south", "s1", "madrid", "castilla-y-leon"),
      move("north", "n1", "castilla-y-leon", "madrid")
    ], loadedDice([2]));
    expect(["r1", "s1", "n1"].map((id) => outcomeOf(result, id))).toEqual([
      { cause: { kind: "head-on", opposingFactionIds: ["north"] }, kind: "bounced-move", order: move("republic", "r1", "madrid", "castilla-y-leon") },
      { cause: { kind: "head-on", opposingFactionIds: ["north"] }, kind: "bounced-move", order: move("south", "s1", "madrid", "castilla-y-leon") },
      { cause: { kind: "head-on", opposingFactionIds: ["republic", "south"] }, kind: "bounced-move", order: move("north", "n1", "castilla-y-leon", "madrid") }
    ]);
    expect(battlesOf(result).every((battle) => battle.site.kind !== "meeting")).toBe(true);
  });
});

describe("M21 returns, retreats, and surrender (C11)", () => {
  // North attacks the Republic in Castilla-La Mancha from Aragon: 12 against 6 is 2:1, and
  // popular resistance (Toledo, Albacete) takes 1, so a 5 drives the defender out.
  const ousted = (extra: readonly ArmySpec[]) => {
    const { scenario, state } = battlefield(spainM2(), [
      a("r1", "republic", "castilla-la-mancha", { type: "infantry-regiment" }),
      ...extra,
      ...["n1", "n2", "n3"].map((id) => a(id, "north", "aragon", { type: "infantry-regiment" }))
    ]);
    return play(scenario, state, ["n1", "n2", "n3"].map((id) => move("north", id, "aragon", "castilla-la-mancha")), loadedDice([14]));
  };

  it("retreats to the adjacent friendly territory holding the most of the faction's armies", () => {
    const result = ousted([a("r2", "republic", "valencia", { type: "infantry-regiment" })]);
    expect(only(result)).toMatchObject({ grade: "driven-out", retreats: [{ from: "castilla-la-mancha", to: "valencia", unitId: "r1" }] });
    expect(at(result, "r1")).toBe("valencia");
  });

  it("breaks a tie between destinations by scenario order", () => {
    const result = ousted([]);
    expect(only(result).retreats).toEqual([{ from: "castilla-la-mancha", to: "madrid", unitId: "r1" }]);
  });

  it("surrenders an army with nowhere to go", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "westfold"), a("r2", "red", "westfold"), a("b1", "blue", "lowlands"), a("r9", "red", "harbor")]);
    const result = play(scenario, state, [move("red", "r1", "westfold", "lowlands"), move("red", "r2", "westfold", "lowlands")], loadedDice([14]));
    expect(only(result)).toMatchObject({ grade: "driven-out", retreats: [], surrenderedUnitIds: ["b1"] });
    expect(armyOf(result, "b1")).toBeUndefined();
  });

  it("makes a returning attacker fall back when another faction took its origin", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "highlands"), a("b1", "blue", "harbor"), a("b2", "blue", "westfold")]);
    // 4 against 5 is 1:2 (-1), and the Harbor batteries take 1 more: a 5 reads row 3.
    const result = play(scenario, state, [move("red", "r1", "highlands", "harbor"), move("blue", "b2", "westfold", "highlands")], loadedDice([14]));
    expect(outcomeOf(result, "b2")?.kind).toBe("successful-move");
    expect(only(result)).toMatchObject({ grade: "attacker-repulsed", retreats: [{ from: "highlands", to: "westfold", unitId: "r1" }] });
    expect(at(result, "r1")).toBe("westfold");
  });

  it("reports a bounce without a battle that falls back, or surrenders, in its move", () => {
    const place = (blocked: boolean) => battlefield(tiny(), [
      a("r1", "red", "harbor"), a("b1", "blue", "harbor"), a("r2", "red", "highlands"), ...(blocked ? [a("r3", "red", "lowlands")] : [])
    ]);
    const orders = [move("red", "r1", "harbor", "isle"), move("blue", "b1", "harbor", "isle"), move("red", "r2", "highlands", "harbor")];
    const open = place(false);
    const fellBack = play(open.scenario, open.state, orders);
    expect(outcomeOf(fellBack, "b1")).toEqual({ cause: { kind: "standoff", opposingFactionIds: ["red"] }, kind: "bounced-move", order: orders[1], retreatedTo: "lowlands" });
    expect(outcomeOf(fellBack, "r1")).toMatchObject({ kind: "bounced-move" });
    expect(at(fellBack, "b1")).toBe("lowlands");

    const closed = place(true);
    const surrendered = play(closed.scenario, closed.state, orders);
    expect(outcomeOf(surrendered, "b1")).toEqual({ capturedByFactionId: "red", cause: { kind: "standoff", opposingFactionIds: ["red"] }, kind: "disbanded-move", men: closed.state.units[unit("b1")]?.strength, order: orders[1] });
    expect(surrendered.finalState.casualties?.[faction("blue")]).toBe(closed.state.units[unit("b1")]?.strength);
    expect(armyOf(surrendered, "b1")).toBeUndefined();
  });
});
