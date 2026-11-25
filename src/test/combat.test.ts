import { describe, expect, it } from "vitest";
import { armyValue, estimateAttack, oddsFor } from "../main/engine/combat";
import { battleModifiers, fightingSide, type ModifierContext } from "../main/engine/d20/modifiers";
import { initialGameState } from "../main/engine/resolution";
import { type CombatModifier, type GameState, type Scenario, type UnitState } from "../main/engine/types";
import { outcomeKeys, resultKeys, statusKeys } from "../main/presentation/outcomes";
import { armyIn, city, faction, spain, territory, tiny, unit } from "./support";
import { popularResistance, unfortified } from "./pinned";

const morale = (demoralized: boolean) => ({ demoralized, quietTurns: 0 });

/** One army of the fixture with its strength and morale overridden. */
function army(state: GameState, id: string, strength: number, demoralized = false): UnitState {
  return { ...armyIn(state, id), morale: morale(demoralized), strength };
}

function withArmy(state: GameState, changed: UnitState): GameState {
  return { ...state, units: { ...state.units, [changed.id]: changed } };
}

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
    expect([armyValue(spain(), legion, "attack"), armyValue(spain(), legion, "defence")]).toEqual([6, 6]);
    expect([armyValue(spain(), militia, "attack"), armyValue(spain(), militia, "defence")]).toEqual([2, 5]);
    expect(armyValue(spain(), { ...regiment, strength: regiment.strength / 2 }, "attack")).toBe(2);
  });

  it("sums the rounded army values, each army fighting from where it stands", () => {
    const combatants = [army(state, "red-guard", 500, true), army(state, "red-rangers", 300, true)].map((unit) => ({ from: unit.territoryId, unit }));
    const side = fightingSide(scenario, state, combatants, "defence");
    // 2.5 rounds to 3 and 1.875 to 2: the side is 5, not the rounded sum of 4.375.
    expect(side).toEqual({
      armies: [
        expect.objectContaining({ factionId: "red", from: "westfold", unitId: "red-guard", value: 3 }),
        expect.objectContaining({ factionId: "red", from: "highlands", unitId: "red-rangers", value: 2 })
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

});

describe("situational modifiers (M14, M22, M24, C7, C17)", () => {
  const scenario = tiny();
  const start = initialGameState(scenario);
  const dug: GameState = { ...start, fortification: { [territory("harbor")]: { factionId: faction("blue"), level: 2 } } };
  const context: ModifierContext = { attackerFactionId: faction("red"), defenderFactionIds: [faction("blue")], diggingIn: true, territoryId: territory("harbor") };
  const batteries: CombatModifier = { factionId: faction("blue"), kind: "faction", modifierId: "harbor-batteries", name: "Harbor batteries", role: "defence", roll: -3 };

  const modifiersOf = (rules: Scenario, state: GameState, change: Partial<ModifierContext> = {}): readonly CombatModifier[] => {
    const fighting = (id: string, role: "attack" | "defence") => {
      const unit = armyIn(state, id);
      return { role, side: fightingSide(rules, state, [{ from: unit.territoryId, unit }], role), units: [unit] };
    };
    return battleModifiers(rules, state, undefined, { ...context, ...change }, fighting("red-rangers", "attack"), fighting("blue-marines", "defence"));
  };

  it("names the works and the faction modifier that help the defender", () => {
    expect(modifiersOf(scenario, dug)).toEqual([{ kind: "dug-in", level: 2, roll: -6 }, batteries]);
  });

  it("gives no works bonus in battles without works or to another faction's defenders", () => {
    expect(modifiersOf(scenario, dug, { diggingIn: false })).toEqual([batteries]);
    const redWorks: GameState = { ...dug, fortification: { [territory("harbor")]: { factionId: faction("red"), level: 2 } } };
    expect(modifiersOf(scenario, redWorks)).toEqual([batteries]);
    const noWorks: GameState = { ...dug, fortification: { [territory("harbor")]: { factionId: faction("blue"), level: 0 } } };
    expect(modifiersOf(scenario, noWorks)).toEqual([batteries]);
  });

  it("applies a faction modifier only while its faction controls a city in the territory", () => {
    const lost: GameState = { ...start, cityControl: { ...start.cityControl, [city("port-town")]: faction("red") } };
    expect(modifiersOf(scenario, lost)).toEqual([]);
    expect(modifiersOf(scenario, start, { territoryId: territory("lowlands") })).toEqual([]);
  });

  it("applies attack bonuses to the attacker and defence bonuses to the defender only", () => {
    const both: Scenario = {
      ...scenario,
      d20: {
        ...scenario.d20,
        factionModifiers: [{ attack: 2, defence: 1, factionId: faction("blue"), id: "both-ways", name: "Both ways", when: "holds-controlled-city" }]
      }
    };
    expect(modifiersOf(both, start, { attackerFactionId: faction("blue"), defenderFactionIds: [faction("red")] })).toEqual([
      { factionId: "blue", kind: "faction", modifierId: "both-ways", name: "Both ways", role: "attack", roll: 2 }
    ]);
    expect(modifiersOf(both, start)).toEqual([
      { factionId: "blue", kind: "faction", modifierId: "both-ways", name: "Both ways", role: "defence", roll: -1 }
    ]);
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
      rollModifier: -6
    });
    if (estimate.kind !== "battle") throw new Error("expected a battle");
    expect(estimate.modifiers.map((modifier) => modifier.kind)).toEqual(["dug-in", "faction"]);
    // Every face less 6: 1-7 destroy the attack, and only a 20 (a 14) drives the defenders out.
    expect(estimate.bands.map((band) => [band.from, band.to, band.gradeId])).toEqual([
      [0, 1, "attacker-destroyed"], [2, 4, "attack-checked"], [5, 7, "attacker-repulsed"], [8, 13, "stalemate"], [14, 16, "driven-out"], [17, 20, "costly-victory"]
    ]);
    expect(estimate.takeChance).toBe(0.05);
  });

  it("applies popular resistance and the halving penalty on the Spain map", () => {
    // Madrid held by its two regiments only, so three regiments attack at 1:1.
    const opening = initialGameState(spain());
    const regimentsOnly = Object.entries(opening.units).filter(([id]) => !["rep-madrid-security", "rep-madrid-sierra-column", "rep-general-miaja"].includes(id));
    const state = { ...opening, units: Object.fromEntries(regimentsOnly) };
    const attackers = [unit("north-san-marcial-22"), unit("north-san-quintin-25"), unit("north-argel-27")];
    const estimate = estimateAttack(popularResistance(spain()), unfortified(state), faction("north"), attackers, territory("madrid"));
    if (estimate.kind !== "battle") throw new Error("expected a battle");
    expect([estimate.attack, estimate.defence, estimate.oddsLabel]).toEqual([12, 12, "1:1"]);
    expect(estimate.modifiers).toEqual([
      { factionId: "republic", kind: "faction", modifierId: "popular-resistance", name: "Popular resistance", role: "defence", roll: -3 },
      { kind: "barricades", roll: -2 }
    ]);
    expect(estimate.takeChance).toBe(0);
    const alone = estimateAttack(popularResistance(spain()), unfortified(state), faction("north"), [unit("north-argel-27")], territory("madrid"));
    if (alone.kind !== "battle") throw new Error("expected a battle");
    expect(alone.oddsLabel).toBe("1:3");
    expect(alone.modifiers.map((modifier) => [modifier.kind, modifier.roll])).toEqual([["faction", -3], ["barricades", -2], ["odds-halving", -3]]);
    expect(alone.takeChance).toBe(0);
  });

  it("refuses an attack with no armies or with another faction's armies", () => {
    expect(() => estimateAttack(scenario, start, faction("red"), [], territory("harbor"))).toThrow("one or more armies");
    expect(() => estimateAttack(scenario, start, faction("red"), [unit("blue-marines")], territory("lowlands"))).toThrow("one or more armies");
    expect(() => estimateAttack(scenario, start, faction("red"), [unit("ghost")], territory("harbor"))).toThrow("unknown army");
  });
});

describe("outcome keys (section 2.1)", () => {
  it("draws seven result families", () => {
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
