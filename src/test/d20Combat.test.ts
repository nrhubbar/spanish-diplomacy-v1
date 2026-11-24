import { describe, expect, it } from "vitest";
import { generateComputerSubmission } from "../main/ai/computerPlayer";
import { seededRandom } from "../main/engine/random";
import { isMoveOrder } from "../main/engine/types";
import { estimateAttack } from "../main/engine/combat";
import { applyGradeSide } from "../main/engine/d20/grades";
import { standingHolder } from "../main/engine/d20/front";
import { battleModifiers, fightingSide } from "../main/engine/d20/modifiers";
import { columnBands, battleOdds, scoreFor } from "../main/engine/d20/odds";
import type { BattleDice } from "../main/engine/dice";
import type { BattleOutcome, FatigueOutcome, GameState, Scenario, TurnResolutionResult, UnitTypeDefinition, UnitTypeId } from "../main/engine/types";
import { loadPackage } from "../main/scenarios/loader";
import { type Json, modularMap, modularScenario } from "./modularFixture";
import { type ArmySpec, battlefield, faction, move, play, territory, unit } from "./support";

/**
 * D1-D7, C2-C7, U6: the d20 dice module on the modular tiny-front fixture. The catalogue below
 * is invented for the tests, so nothing here depends on Spain's numbers.
 */

const assetPaths = new Set(["src/test/fixtures/scenarios/tiny-front/geometry.svg", "src/test/fixtures/scenarios/tiny-front/foot.svg"]);

const catalogue = [
  ["wiped", 100, "none", 0, "none", false, 0],
  ["checked", 10, "none", 0, "none", false, 0],
  ["level", 10, "none", 10, "none", false, 0],
  ["gives", 10, "none", 10, "none", false, 1],
  ["pushed", 10, "none", 20, "half", false, 2],
  ["driven", 10, "none", 20, "half", false, "all"],
  ["broken", 0, "none", 35, "all", true, "all"],
  ["destroyed", 10, "none", 100, "none", false, "all"]
] as const;

type GradeName = (typeof catalogue)[number][0];

/** The fixture with the test catalogue, and every cell of the table `cell(column, score)`. */
function d20Scenario(cell: (column: number, score: number) => GradeName = (column, score) => catalogue[Math.min(7, Math.floor((score + 3 * column) / 4))]?.[0] ?? "level", mutate: (document: Json) => void = () => undefined): Scenario {
  const document = modularScenario();
  const d20 = document["d20"] as Json;
  d20["grades"] = catalogue.map(([id, attackerLoss, attackerMorale, defenderLoss, defenderMorale, weakest, ground]) => ({
    attacker: { demoralized: attackerMorale, lossPercent: attackerLoss },
    defender: { demoralized: defenderMorale, lossPercent: defenderLoss, ...(weakest ? { weakestDestroyed: true } : {}) },
    ground,
    id,
    name: id
  }));
  d20["table"] = Array.from({ length: 7 }, (_, column) => Array.from({ length: 21 }, (_, score) => cell(column, score)));
  mutate(document);
  return loadPackage({ assetPaths, mapDocument: modularMap(), mapPath: "map.json", scenarioDocument: document, scenarioPath: "scenario.json" }).scenario;
}

const every = (grade: GradeName) => d20Scenario(() => grade);

/** Loaded d20s: battle `i` rolls `faces[i]`; later draws (tie-breaks) return 0. */
function loadedD20(faces: readonly number[]): BattleDice {
  return (index) => {
    let draws = 0;
    return () => {
      draws += 1;
      return draws === 1 ? ((faces[index] ?? 10) - 0.5) / 20 : 0;
    };
  };
}

const types: readonly UnitTypeDefinition[] = [
  { attack: 3, defence: 2, effects: [{ bonus: 1, exceptWeather: [], kind: "roll-bonus-per-points", max: 3, per: 3, role: "attack" }, { kind: "cannot-attack-alone" }], id: "cannon" as UnitTypeId, kind: "ground", name: "Cannon", orders: ["move"], upkeep: {} },
  { attack: 3, defence: 2, effects: [{ bonus: 1, exceptWeather: ["mud" as never], kind: "roll-bonus-per-points", max: 2, per: 3, role: "attack" }], id: "tank" as UnitTypeId, kind: "ground", name: "Tank", orders: ["move"], upkeep: {} }
];

function field(scenario: Scenario, armies: readonly ArmySpec[], state: Partial<GameState> = {}) {
  return battlefield(scenario, armies, { state, types });
}

function d20Battles(result: TurnResolutionResult): readonly BattleOutcome[] {
  return result.outcomes.flatMap((outcome) => (outcome.kind === "battle" ? [outcome] : []));
}

function onlyBattle(result: TurnResolutionResult): BattleOutcome {
  const battles = d20Battles(result);
  expect(battles).toHaveLength(1);
  const [battle] = battles;
  if (battle === undefined) throw new Error("no battle");
  return battle;
}

describe("the d20 table and odds (D1, D3)", () => {
  it("reads the explicit table, shows a column as bands, and spreads chances over the 20 faces", () => {
    const scenario = d20Scenario();
    const rules = scenario.d20;
    const bands = columnBands(rules, 0);
    expect(bands[0]).toEqual({ from: 0, gradeId: "wiped", to: 3 });
    expect(bands.at(-1)?.to).toBe(20);
    const odds = battleOdds(rules, 8, 4, []);
    expect([odds.column, odds.oddsLabel]).toEqual([2, "2:1"]);
    expect([...odds.chances.values()].reduce((sum, chance) => sum + chance, 0)).toBeCloseTo(1);
    expect(odds.takeChance).toBeCloseTo([...odds.chances].filter(([id]) => ["driven", "broken", "destroyed"].includes(id)).reduce((sum, [, chance]) => sum + chance, 0));
    expect(odds.gainChance).toBeGreaterThanOrEqual(odds.takeChance);
    expect([scoreFor(1, -5), scoreFor(19, 4), scoreFor(7, 2)]).toEqual([0, 20, 9]);
  });

  it("restates the odds steps x3: below 1:1 per halving, and above 6:1 per step", () => {
    const rules = d20Scenario().d20;
    expect(battleOdds(rules, 2, 8, []).modifiers).toEqual([{ halvings: 2, kind: "odds-halving", roll: -6 }]);
    expect(battleOdds(rules, 32, 4, []).modifiers).toEqual([{ kind: "odds-overflow", roll: 6 }]);
  });
});

describe("d20 modifiers (D3-D5, C6, U6)", () => {
  it("gives the defender works at the d20's roll a pip (R8), faction modifiers from the d20 block, and barricades for a city it holds", () => {
    const base = field(d20Scenario(), [{ faction: "red", id: "r1", territory: "highlands" }, { faction: "blue", id: "b1", territory: "harbor" }]);
    // The fixture's d20 block makes a pip worth 3, so two pips take 6.
    const state: GameState = { ...base.state, fortification: { [territory("harbor")]: { factionId: faction("blue"), level: 2 } } };
    const estimate = estimateAttack(base.scenario, state, faction("red"), [unit("r1")], territory("harbor"));
    expect(estimate.kind === "battle" ? estimate.modifiers.map((modifier) => [modifier.kind, modifier.roll]) : []).toEqual([["dug-in", -6], ["faction", -3], ["barricades", -1], ["odds-halving", -3]]);
  });

  it("counts only the best general on a side, with his trait, and artillery per 3 points up to its cap", () => {
    // The fixture's general keeps his roster link, so he is placed by hand rather than redefined.
    const placed = field(d20Scenario(), [
      { faction: "red", id: "g1", territory: "highlands", type: "cannon" },
      { faction: "red", id: "g2", territory: "highlands", type: "cannon" },
      { faction: "red", id: "g3", territory: "highlands", type: "cannon" },
      { faction: "red", id: "g4", territory: "highlands", type: "cannon" },
      { faction: "blue", id: "b1", territory: "lowlands" }
    ]);
    const { scenario } = placed;
    const state: GameState = { ...placed.state, units: { ...placed.state.units, [unit("red-staff")]: { factionId: faction("red"), fatigue: 0, id: unit("red-staff"), morale: { demoralized: false, quietTurns: 0 }, strength: 50, territoryId: territory("highlands") } } };
    const attackers = ["red-staff", "g1", "g2", "g3", "g4"].map((id) => state.units[unit(id)]).flatMap((value) => value ?? []);
    const defenders = Object.values(state.units).filter((value) => value.factionId === faction("blue"));
    const attacker = fightingSide(scenario, state, attackers.map((value) => ({ from: value.territoryId, unit: value })), "attack");
    const defender = fightingSide(scenario, state, defenders.map((value) => ({ from: value.territoryId, unit: value })), "defence");
    const modifiers = battleModifiers(scenario, state, undefined, { attackerFactionId: faction("red"), defenderFactionIds: [faction("blue")], diggingIn: true, territoryId: territory("lowlands") },
      { role: "attack", side: attacker, units: attackers }, { role: "defence", side: defender, units: defenders });
    expect(attacker.value).toBe(12);
    expect(modifiers.map((modifier) => [modifier.kind, modifier.roll])).toEqual([["general", 1], ["trait", 1], ["unit-bonus", 3]]);
  });

  it("gives tanks nothing in the weather they list", () => {
    const { scenario, state } = field(d20Scenario(), [
      { faction: "red", id: "t1", territory: "highlands", type: "tank" },
      { faction: "red", id: "t2", territory: "highlands", type: "tank" },
      { faction: "blue", id: "b1", territory: "harbor" }
    ]);
    const muddy: GameState = { ...state, weather: { outcomes: { ["plains" as never]: "mud" as never }, roll: 12 } };
    const kinds = (game: GameState) => {
      const estimate = estimateAttack(scenario, game, faction("red"), [unit("t1"), unit("t2")], territory("harbor"));
      return estimate.kind === "battle" ? estimate.modifiers.map((modifier) => modifier.kind) : [];
    };
    expect(kinds(state)).toContain("unit-bonus");
    expect(kinds(muddy)).not.toContain("unit-bonus");
  });

  it("makes a side Fatigued when fatigued units carry at least half its value (declog D6)", () => {
    const { scenario, state } = field(d20Scenario(), [
      { faction: "red", id: "r1", territory: "highlands" },
      { faction: "red", id: "r2", territory: "highlands" },
      { faction: "blue", id: "b1", territory: "harbor" }
    ]);
    const tired: GameState = { ...state, units: { ...state.units, [unit("r1")]: { ...state.units[unit("r1")]!, fatigue: 2 } } };
    const fatigue = (game: GameState) => {
      const estimate = estimateAttack(scenario, game, faction("red"), [unit("r1"), unit("r2")], territory("harbor"));
      return estimate.kind === "battle" ? estimate.modifiers.filter((modifier) => modifier.kind === "fatigue") : [];
    };
    expect(fatigue(state)).toEqual([]);
    expect(fatigue(tired)).toEqual([{ factionId: "red", kind: "fatigue", role: "attack", roll: -2 }]);
  });
});

describe("what a grade does to a side (D2, D6)", () => {
  it("takes a share of each unit's men, breaks up units below 10 percent, and demoralizes the weakest half", () => {
    const { scenario, state } = field(d20Scenario(), [
      { faction: "blue", id: "b1", territory: "harbor" },
      { faction: "blue", fullStrength: 100, id: "b2", strength: 11, territory: "harbor" },
      { faction: "blue", fullStrength: 100, id: "b3", strength: 60, territory: "harbor" }
    ]);
    const side = fightingSide(scenario, state, Object.values(state.units).map((value) => ({ from: value.territoryId, unit: value })), "defence");
    const casualties = applyGradeSide(scenario, state, { demoralized: "half", lossPercent: 20 }, side, state.units, 0.1);
    expect(casualties.losses).toEqual([
      { destroyed: false, men: 20, unitId: "b1" },
      { destroyed: true, men: 11, unitId: "b2" },
      { destroyed: false, men: 12, unitId: "b3" }
    ]);
    // Half of the side's value as it fought (9): the broken-up unit's point counts, so both survivors go.
    expect(casualties.demoralized).toEqual(["b3", "b1"]);
    expect(casualties.survivors.map((value) => [value.id, value.strength, value.morale.demoralized])).toEqual([["b1", 80, true], ["b3", 48, true]]);
  });

  it("destroys the weakest defender on a broken grade, and spares generals any losses", () => {
    const placed = field(d20Scenario(), [
      { faction: "red", id: "r1", territory: "westfold" },
      { faction: "red", fullStrength: 100, id: "r2", strength: 50, territory: "westfold" }
    ]);
    const { scenario } = placed;
    const state: GameState = { ...placed.state, units: { [unit("red-staff")]: { factionId: faction("red"), fatigue: 0, id: unit("red-staff"), morale: { demoralized: false, quietTurns: 0 }, strength: 50, territoryId: territory("westfold") }, ...placed.state.units } };
    const side = fightingSide(scenario, state, Object.values(state.units).map((value) => ({ from: value.territoryId, unit: value })), "defence");
    const casualties = applyGradeSide(scenario, state, { demoralized: "all", lossPercent: 35, weakestDestroyed: true }, side, state.units, 0.1);
    expect(casualties.losses).toEqual([{ destroyed: false, men: 35, unitId: "r1" }, { destroyed: true, men: 50, unitId: "r2" }]);
    expect(casualties.survivors.map((value) => [value.id, value.morale.demoralized])).toEqual([["red-staff", false], ["r1", true]]);
  });
});

describe("d20 battles in a turn (M17-M21, P4, P5)", () => {
  const assault = [{ faction: "red", id: "r1", territory: "highlands" }, { faction: "blue", id: "b1", territory: "harbor" }] as const;

  it("takes the whole territory on a ground-all grade: the defenders retreat and the attackers move in", () => {
    const { scenario, state } = field(every("driven"), [...assault, { faction: "blue", id: "b2", territory: "lowlands" }]);
    const result = play(scenario, state, [move("red", "r1", "highlands", "harbor")], loadedD20([10]));
    const battle = onlyBattle(result);
    expect([battle.grade, battle.ground, battle.site]).toEqual(["driven", "all", { kind: "assault", occupation: { factionId: "red", kind: "taken" }, territoryId: "harbor" }]);
    expect(battle.retreats).toEqual([{ from: "harbor", to: "lowlands", unitId: "b1" }]);
    expect(result.finalState.units[unit("r1")]).toMatchObject({ fatigue: 1, strength: 90, territoryId: "harbor" });
    expect(result.outcomes).toContainEqual({ demoralized: false, factionId: "red", fatigue: 1, kind: "fatigue", unitId: "r1" });
  });

  it("sends the attackers home on a grade without ground, the defenders holding", () => {
    const { scenario, state } = field(every("level"), assault);
    const result = play(scenario, state, [move("red", "r1", "highlands", "harbor")], loadedD20([10]));
    expect(onlyBattle(result)).toMatchObject({ ground: 0, site: { occupation: { kind: "held" } } });
    expect(result.finalState.units[unit("r1")]?.territoryId).toBe("highlands");
    expect(result.finalState.units[unit("b1")]).toMatchObject({ strength: 90, territoryId: "harbor" });
  });

  it("brings the attackers in beside the defenders on partial ground where the territory has several sub-territories", () => {
    const { scenario, state } = field(every("gives"), [{ faction: "blue", id: "b1", territory: "lowlands" }, { faction: "red", id: "r1", territory: "westfold" }]);
    const result = play(scenario, state, [move("blue", "b1", "lowlands", "westfold")], loadedD20([10]));
    expect(onlyBattle(result).ground).toBe(1);
    expect([result.finalState.units[unit("b1")]?.territoryId, result.finalState.units[unit("r1")]?.territoryId]).toEqual(["westfold", "westfold"]);
  });

  it("treats partial ground as a stalemate where the territory has one sub-territory (Q-D20-7)", () => {
    const { scenario, state } = field(every("pushed"), assault);
    const result = play(scenario, state, [move("red", "r1", "highlands", "harbor")], loadedD20([10]));
    expect(onlyBattle(result).ground).toBe(0);
    expect(result.finalState.units[unit("r1")]?.territoryId).toBe("highlands");
  });

  it("turns artillery alone back without a battle (D5)", () => {
    const { scenario, state } = field(every("destroyed"), [{ faction: "red", id: "g1", territory: "highlands", type: "cannon" }, { faction: "blue", id: "b1", territory: "harbor" }]);
    const result = play(scenario, state, [move("red", "g1", "highlands", "harbor")], loadedD20([10]));
    expect(d20Battles(result)).toEqual([]);
    expect(result.outcomes[0]).toMatchObject({ kind: "bounced-move" });
  });

  it("matches the estimate's grade for the rolled face (C15)", () => {
    const { scenario, state } = field(d20Scenario(), assault);
    const estimate = estimateAttack(scenario, state, faction("red"), [unit("r1")], territory("harbor"));
    if (estimate.kind !== "battle") throw new Error("expected a d20 estimate");
    for (const die of [1, 7, 13, 20]) {
      const battle = onlyBattle(play(scenario, state, [move("red", "r1", "highlands", "harbor")], loadedD20([die])));
      expect([battle.modifiers, battle.column, battle.score]).toEqual([estimate.modifiers, estimate.column, scoreFor(die, estimate.rollModifier)]);
      expect(estimate.bands.find((band) => band.from <= battle.score && battle.score <= band.to)?.gradeId).toBe(battle.grade);
    }
  });
});

describe("standing battles and three-way defence (M27, C2, C3)", () => {
  it("fights a standing battle where two factions share a territory, and only the attacker tires", () => {
    const { scenario, state } = field(every("level"), [{ faction: "red", id: "r1", territory: "isle" }, { faction: "blue", id: "b1", territory: "isle" }]);
    const result = play(scenario, state, [], loadedD20([10]));
    const battle = onlyBattle(result);
    expect(battle.site.kind).toBe("standing");
    const tired = result.outcomes.filter((outcome): outcome is FatigueOutcome => outcome.kind === "fatigue").map((outcome) => outcome.unitId);
    expect(tired).toEqual([battle.attackerFactionId === faction("red") ? "r1" : "b1"]);
  });

  it("makes the capital holder, else the last controller, the defender among three or more factions", () => {
    const { scenario, state } = field(d20Scenario(), [{ faction: "red", id: "r1", territory: "harbor" }]);
    expect(standingHolder(scenario, state, territory("harbor"), [faction("red"), faction("blue"), faction("green")])).toBe("blue");
    const red: GameState = { ...state, subTerritories: { ...state.subTerritories, ["port-quarter" as never]: { ...state.subTerritories["port-quarter" as never]!, holder: faction("red") } } };
    expect(standingHolder(scenario, red, territory("harbor"), [faction("red"), faction("blue")])).toBe("red");
    expect(standingHolder(scenario, state, territory("harbor"), [faction("red"), faction("green")])).toBeUndefined();
  });
});

describe("fatigue and morale (C4-C6, M22, M23)", () => {
  it("demoralizes a unit that attacks at the top of the track, and resets a quiet unit in uncontested ground", () => {
    const { scenario, state } = field(every("level"), [
      { faction: "red", id: "r1", territory: "highlands" },
      { faction: "red", id: "r2", territory: "westfold" },
      { faction: "blue", id: "b1", territory: "harbor" }
    ]);
    const worn: GameState = { ...state, units: { ...state.units, [unit("r1")]: { ...state.units[unit("r1")]!, fatigue: 2 }, [unit("r2")]: { ...state.units[unit("r2")]!, fatigue: 2 } } };
    const result = play(scenario, worn, [move("red", "r1", "highlands", "harbor")], loadedD20([10]));
    expect(result.finalState.units[unit("r1")]).toMatchObject({ fatigue: 3, morale: { demoralized: true } });
    expect(result.finalState.units[unit("r2")]?.fatigue).toBe(0);
    expect(onlyBattle(result).modifiers).toContainEqual({ factionId: "red", kind: "fatigue", role: "attack", roll: -2 });
  });

  it("lets a demoralized unit recover by resting only in uncontested ground (C4)", () => {
    const { scenario, state } = field(every("level"), [
      { demoralized: true, faction: "red", id: "r1", territory: "highlands" },
      { demoralized: true, faction: "red", id: "r2", territory: "isle" },
      { faction: "blue", id: "b1", territory: "isle" }
    ]);
    const result = play(scenario, state, [], loadedD20([10]));
    expect(result.finalState.units[unit("r1")]?.morale.demoralized).toBe(false);
    expect(result.finalState.units[unit("r2")]?.morale.demoralized).toBe(true);
  });

  it("digs in a pip a turn, up to the scenario's cap in pips (R8)", () => {
    const { scenario, state } = field(every("level"), [{ faction: "red", id: "r1", territory: "highlands" }]);
    const once = play(scenario, state, [], loadedD20([]));
    expect(once.finalState.fortification[territory("highlands")]).toEqual({ factionId: "red", level: 1 });
    const { max } = scenario.combat.diggingIn;
    const capped = play(scenario, { ...state, fortification: { [territory("highlands")]: { factionId: faction("red"), level: max } } }, [], loadedD20([]));
    expect(capped.finalState.fortification[territory("highlands")]?.level).toBe(max);
  });
});

describe("the computer player on the d20 (C15, H5)", () => {
  // These boards count on one-step reach; under `allowance` rail would bring other units in (M3, M4).
  const singleStep = (document: Json): void => { (document["rules"] as Json)["movement"] = "single-step"; };
  const plan = (scenario: Scenario, state: GameState) =>
    generateComputerSubmission(scenario, state, faction("red"), seededRandom(5)).orders.filter(isMoveOrder).map((order) => [order.unitId, order.to]);

  it("attacks a weak defender with fresh units, but rests a unit one attack away from exhaustion", () => {
    const { scenario, state } = field(d20Scenario(undefined, singleStep), [
      { faction: "red", id: "r1", territory: "highlands" },
      { faction: "red", id: "r2", territory: "westfold" },
      { faction: "blue", fullStrength: 100, id: "b1", strength: 30, territory: "lowlands" },
      { faction: "blue", id: "b2", territory: "harbor" }
    ]);
    expect(plan(scenario, state)).toContainEqual(["r2", "lowlands"]);
    const worn: GameState = { ...state, units: { ...state.units, [unit("r2")]: { ...state.units[unit("r2")]!, fatigue: 2 } } };
    // Blue is one territory short here, so a worn unit attacks it all the same; with no alarm it rests.
    expect(plan(scenario, worn)).toContainEqual(["r2", "lowlands"]);
    const red = scenario.ai.profiles[faction("red")]!;
    const calm = { ...scenario, ai: { ...scenario.ai, profiles: { ...scenario.ai.profiles, [faction("red")]: { ...red, victoryAlarm: { ...red.victoryAlarm, critical: 0, perStep: 0 } } } } };
    expect(plan(calm, state)).toContainEqual(["r2", "lowlands"]);
    expect(plan(calm, worn)).not.toContainEqual(["r2", "lowlands"]);
  });

  it("never sends artillery to attack alone (D5)", () => {
    const { scenario, state } = field(d20Scenario(undefined, singleStep), [
      { faction: "red", id: "g1", territory: "highlands", type: "cannon" },
      { faction: "red", id: "r2", territory: "westfold" },
      { faction: "blue", fullStrength: 100, id: "b1", strength: 20, territory: "harbor" }
    ]);
    expect(plan(scenario, state)).not.toContainEqual(["g1", "harbor"]);
  });
});
