import { describe, expect, it } from "vitest";
import { airBattle, airBattleFought, airBattleOdds, groundSupport } from "../../main/engine/air/airBattle";
import {
  airBattleAircraft,
  airBattleInput,
  airBattleRolls,
  airOverBattle,
  airOverHookedBattle,
  antiAirOf,
  supportModifiersOf
} from "../../main/engine/air/groundSupport";
import { emptyAirScratch } from "../../main/engine/air/scratch";
import { pick, rollStream, seededRollStreams } from "../../main/engine/dice";
import { initialGameState, resolveTurn } from "../../main/engine/resolution";
import type {
  AirBattleAircraft,
  AirBattleInput,
  AirMission,
  AirMissionOrder,
  GameState,
  RaisedUnitDefinition,
  Scenario,
  TurnOutcome,
  UnitTypeDefinition,
  UnitTypeId
} from "../../main/engine/types";
import { estimateAttack } from "../../main/engine/combat";
import { faction, move, spainWithAir, territory, unit } from "../support";

/** R10, R11: the air battle before a battle, and whose Ground Support applies. */

const north = faction("north");
const republic = faction("republic");
const plane = (id: string, mission: AirBattleAircraft["mission"], airRoll: number, supportRoll = 0, factionId = north): AirBattleAircraft =>
  ({ airRoll, factionId, mission, supportRoll, unitId: unit(id) });
const input = (attacker: readonly AirBattleAircraft[], defender: readonly AirBattleAircraft[], antiAir = 0, supportMax?: number): AirBattleInput => ({
  attacker: { aircraft: attacker, antiAir: 0, factionId: north },
  defender: { aircraft: defender, antiAir, factionId: republic },
  ...(supportMax === undefined ? {} : { supportMax })
});
const mission = (factionId: string, unitId: string, flown: AirMission): AirMissionOrder => ({ factionId: faction(factionId), kind: "air-mission", mission: flown, unitId: unit(unitId) });

describe("the air battle (R11, pure)", () => {
  const fighter = plane("f", "patrol", 2);
  const bomber = plane("b", "support", 1, 3);

  it("adds each aircraft's air roll to its d20, and the defender's AA", () => {
    const both = input([bomber], [{ ...fighter, factionId: republic }], 3);
    expect(airBattle(both, { attacker: 10, defender: 5 })).toEqual({ attackerTotal: 11, defenderTotal: 10, rolls: { attacker: 10, defender: 5 }, winner: "attacker" });
    expect(airBattle(both, { attacker: 9, defender: 5 }).winner).toBe("tie");
    expect(airBattle(both, { attacker: 2, defender: 5 }).winner).toBe("defender");
  });

  it("gives exact odds over all 400 pairs of d20s", () => {
    expect(airBattleOdds(input([fighter], [fighter]))).toEqual({ attackerWins: 190 / 400, defenderWins: 190 / 400, tie: 20 / 400 });
    // +1 for the attacker: it wins when its die is at least the defender's (210), ties when one under (19).
    expect(airBattleOdds(input([bomber], []))).toEqual({ attackerWins: 210 / 400, defenderWins: 171 / 400, tie: 19 / 400 });
  });

  it("is fought when both sides have aircraft over the battle, or the attacker's Ground Support faces AA", () => {
    expect(airBattleFought(input([fighter], [fighter]))).toBe(true);
    expect(airBattleFought(input([bomber], [], 3))).toBe(true);
    expect(airBattleFought(input([bomber], []))).toBe(false);
    // A Patrol alone does not face AA, and the defender's own support never does.
    expect(airBattleFought(input([fighter], [], 3))).toBe(false);
    expect(airBattleFought(input([], [bomber], 3))).toBe(false);
  });

  it("gives only the winner's Ground Support, none on a tie, and every side's with no air battle", () => {
    const sides = input([bomber], [plane("d", "support", 1, 3, republic)]);
    expect(groundSupport(sides, "attacker")).toEqual({ attacker: { roll: 3, unitIds: [unit("b")] }, defender: { roll: 0, unitIds: [] } });
    expect(groundSupport(sides, "defender")).toEqual({ attacker: { roll: 0, unitIds: [] }, defender: { roll: 3, unitIds: [unit("d")] } });
    expect(groundSupport(sides, "tie")).toEqual({ attacker: { roll: 0, unitIds: [] }, defender: { roll: 0, unitIds: [] } });
    expect(groundSupport(sides, undefined)).toEqual({ attacker: { roll: 3, unitIds: [unit("b")] }, defender: { roll: 3, unitIds: [unit("d")] } });
  });

  it("counts at most `supportMax` aircraft, best first then by id, and nothing from Patrol", () => {
    const many = [plane("c", "support", 1, 3), plane("a", "support", 1, 3), plane("z", "support", 1, 4), plane("p", "patrol", 2), plane("n", "support", 1, 0)];
    expect(groundSupport(input(many, [], 0, 2), "attacker").attacker).toEqual({ roll: 7, unitIds: [unit("z"), unit("a")] });
    expect(groundSupport(input(many, []), "attacker").attacker).toEqual({ roll: 10, unitIds: [unit("z"), unit("a"), unit("c")] });
    expect(groundSupport(input([plane("x", "support", 1, 3), plane("x", "support", 1, 3)], [], 0, 1), "attacker").attacker.unitIds).toEqual([unit("x")]);
  });
});

describe("the air over a battle, from the scenario (R10, R11)", () => {
  const scenario = spainWithAir();
  const state = initialGameState(scenario);
  const madrid = territory("madrid");

  it("reads each aircraft's numbers from its type: 2 a fighter and 1 a bomber in the air, +3 on Ground Support", () => {
    const raised = state.raised;
    expect(airBattleAircraft(scenario, raised, mission("republic", "rep-ni52-fighters", { kind: "patrol", territoryId: madrid })))
      .toEqual({ airRoll: 2, factionId: republic, mission: "patrol", supportRoll: 0, unitId: unit("rep-ni52-fighters") });
    expect(airBattleAircraft(scenario, raised, mission("republic", "rep-ni52-fighters", { kind: "support", territoryId: madrid }))?.supportRoll).toBe(3);
    expect(airBattleAircraft(scenario, raised, mission("republic", "rep-breguet-bombers", { kind: "support", territoryId: madrid }))).toMatchObject({ airRoll: 1, supportRoll: 3 });
    expect(airBattleAircraft(scenario, raised, mission("republic", "rep-catalan-recon", { kind: "recon", territoryId: madrid }))).toBeUndefined();
    expect(airBattleAircraft(scenario, raised, mission("republic", "no-such-plane", { kind: "patrol", territoryId: madrid }))).toMatchObject({ airRoll: 0, supportRoll: 0 });
  });

  it("takes the defenders' best AA as a plus", () => {
    const withBattery = raise(state, "aa-1", "republic", "anti-air-battery", "madrid");
    expect(antiAirOf(scenario, withBattery.raised, [unit("aa-1"), unit("rep-wad-ras-1")])).toBe(3);
    expect(antiAirOf(scenario, state.raised, [unit("rep-wad-ras-1")])).toBe(0);
  });

  it("builds the input from the flights over the battle's territory, the defenders' AA and the cap", () => {
    const flights = [
      mission("north", "n-bomber", { kind: "support", territoryId: madrid }),
      mission("republic", "rep-ni52-fighters", { kind: "patrol", territoryId: madrid }),
      mission("republic", "rep-breguet-bombers", { kind: "support", territoryId: territory("valencia") }),
      mission("republic", "rep-catalan-recon", { kind: "recon", territoryId: madrid }),
      mission("south", "south-ju52-bombers", { kind: "support", territoryId: madrid })
    ];
    const raised = raise(state, "n-bomber", "north", "bomber-squadron", "castilla-y-leon");
    const built = airBattleInput(scenario, raised, { attackerFactionId: north, defenderFactionIds: [republic], defenderUnitIds: [unit("rep-wad-ras-1")], territoryId: madrid }, flights);
    expect(built.attacker.aircraft.map((aircraft) => aircraft.unitId)).toEqual([unit("n-bomber")]);
    expect(built.defender.aircraft.map((aircraft) => aircraft.unitId)).toEqual([unit("rep-ni52-fighters")]);
    expect(built.defender.antiAir).toBe(0);
    expect(built.supportMax).toBe(2);
    const uncapped = airBattleInput({ ...scenario, air: { ...scenario.air!, supportMax: undefined } }, raised, { attackerFactionId: north, defenderFactionIds: [], defenderUnitIds: [], territoryId: madrid }, flights);
    expect(uncapped).not.toHaveProperty("supportMax");
    expect(uncapped.defender.factionId).toBe(north);
  });

  it("settles nothing without aircraft, applies unopposed support, and rolls a fought battle", () => {
    const rolls = { attacker: 15, defender: 4 };
    expect(airOverBattle(input([], []), () => rolls)).toBeUndefined();
    const lone = airOverBattle(input([plane("b", "support", 1, 3)], []), () => { throw new Error("no roll without an air battle"); });
    expect(lone).toEqual({ input: input([plane("b", "support", 1, 3)], []), support: { attacker: { roll: 3, unitIds: [unit("b")] }, defender: { roll: 0, unitIds: [] } } });
    const fought = airOverBattle(input([plane("b", "support", 1, 3)], [], 3), () => rolls);
    expect(fought?.result?.winner).toBe("attacker");
    expect(fought?.support.attacker.roll).toBe(3);
  });

  it("rolls each battle's two d20s on the air-battle stream of its index, the attacker's first", () => {
    const stream = rollStream(11, "air-battle", 4, 2);
    const attacker = pick(stream, 20);
    expect(airBattleRolls({ ...emptyAirScratch, streams: seededRollStreams(11, 4) }, 2)).toEqual({ attacker, defender: pick(stream, 20) });
    expect(airBattleRolls(emptyAirScratch, 0)).toEqual({ attacker: 1, defender: 1 });
  });

  it("finds the defenders' AA in the territory when the hook names no defending units", () => {
    const withBattery = raise(state, "aa-1", "republic", "anti-air-battery", "madrid");
    const scratch = { ...emptyAirScratch, streams: seededRollStreams(3, 1), support: [mission("north", "rep-ni52-fighters", { kind: "support", territoryId: madrid })] };
    const air = airOverHookedBattle({ attackerFactionId: north, defenderFactionIds: [republic], diggingIn: true, scenario, state: withBattery, territoryId: madrid }, scratch);
    expect(air?.input.defender.antiAir).toBe(3);
    expect(air?.result).toBeDefined();
  });

  it("names each side's support for its first counted aircraft's faction", () => {
    const sides = input([plane("b", "support", 1, 3)], [plane("d", "support", 1, 3, faction("south"))]);
    expect(supportModifiersOf(undefined)).toEqual([]);
    expect(supportModifiersOf({ input: sides, support: groundSupport(sides, undefined) })).toEqual([
      { factionId: north, kind: "air-support", role: "attack", roll: 3, unitIds: [unit("b")] },
      { factionId: "south", kind: "air-support", role: "defence", roll: -3, unitIds: [unit("d")] }
    ]);
    expect(supportModifiersOf({ input: sides, support: groundSupport(sides, "tie") })).toEqual([]);
  });
});

describe("the air battle in a turn (R11)", () => {
  const scenario = spainWithAir();
  // A Republican attack on Castilla y León with two aircraft on Ground Support, against the North's AA battery there.
  const state = raise(initialGameState(scenario), "r_north_anti-air-battery_1", "north", "anti-air-battery", "castilla-y-leon");
  const target = territory("castilla-y-leon");
  const attack = ["rep-wad-ras-1", "rep-covadonga-4", "rep-madrid-security"].map((id) => move("republic", id, "madrid", "castilla-y-leon"));
  const support = [mission("republic", "rep-breguet-bombers", { kind: "support", territoryId: target }), mission("republic", "rep-ni52-fighters", { kind: "support", territoryId: target })];
  const of = <Kind extends TurnOutcome["kind"]>(outcomes: readonly TurnOutcome[], kind: Kind) => outcomes.filter((outcome): outcome is Extract<TurnOutcome, { kind: Kind }> => outcome.kind === kind);

  it("fights it on its own stream, reports it, and gives Ground Support only when the attacker wins the air", () => {
    const winners = new Set<string>();
    for (let seed = 1; seed <= 60; seed += 1) {
      const result = resolveTurn(scenario, state, [{ factionId: republic, orders: [...attack, ...support] }], seed);
      const [airBattleOutcome] = of(result.outcomes, "air-battle");
      const [battle] = of(result.outcomes, "battle");
      if (airBattleOutcome === undefined || battle === undefined) throw new Error("expected an air battle over the battle");
      const stream = rollStream(seed, "air-battle", state.turnNumber, airBattleOutcome.battleIndex);
      const attackerDie = pick(stream, 20);
      expect(airBattleOutcome.result.rolls).toEqual({ attacker: attackerDie, defender: pick(stream, 20) });
      // Fighter 2 and bomber 1 against the battery's AA of 3.
      expect(airBattleOutcome.result.attackerTotal).toBe(airBattleOutcome.result.rolls.attacker + 3);
      expect(airBattleOutcome.result.defenderTotal).toBe(airBattleOutcome.result.rolls.defender + 3);
      winners.add(airBattleOutcome.result.winner);
      const air = battle.modifiers.filter((modifier) => modifier.kind === "air-support");
      const won = airBattleOutcome.result.winner === "attacker";
      expect(air).toEqual(won ? [{ factionId: republic, kind: "air-support", role: "attack", roll: 6, unitIds: [unit("rep-breguet-bombers"), unit("rep-ni52-fighters")] }] : []);
      expect(airBattleOutcome.support.attacker.roll).toBe(won ? 6 : 0);
      expect(of(result.outcomes, "air-support").map((outcome) => outcome.applied)).toEqual([won, won]);
      // Nobody loses aircraft in the air battle.
      expect(result.finalState.units[unit("rep-breguet-bombers")]).toBeDefined();
    }
    expect([...winners].sort()).toEqual(["attacker", "defender", "tie"]);
  });

  it("has no air battle, and full support, with no enemy aircraft or AA over the battle", () => {
    const result = resolveTurn(scenario, initialGameState(scenario), [{ factionId: republic, orders: [...attack, ...support] }], 5);
    expect(of(result.outcomes, "air-battle")).toEqual([]);
    expect(of(result.outcomes, "battle")[0]?.modifiers).toContainEqual({ factionId: republic, kind: "air-support", role: "attack", roll: 6, unitIds: [unit("rep-breguet-bombers"), unit("rep-ni52-fighters")] });
  });
});

describe("the odds with planned Ground Support (R11)", () => {
  const attackers = [unit("rep-wad-ras-1"), unit("rep-covadonga-4")];
  const aircraft = [unit("rep-breguet-bombers"), unit("rep-ni52-fighters")];
  const target = territory("castilla-y-leon");

  // The defenders' infantry carry AA of 3 in the guarded variant.
  const guardedBy = (scenario: Scenario): Scenario => {
    const retype = (type: UnitTypeDefinition): UnitTypeDefinition => (type.id === "infantry-regiment" ? { ...type, effects: [...type.effects, { kind: "raid-defence", roll: -3 }] } : type);
    return { ...scenario, index: { ...scenario.index, unitTypes: new Map([...scenario.index.unitTypes].map(([id, type]) => [id, retype(type)])) }, unitTypes: scenario.unitTypes.map(retype) };
  };

  const plainScenario = spainWithAir();
  const state = initialGameState(plainScenario);
  const open = plainScenario;
  const guarded = guardedBy(plainScenario);
  const battle = (scenario: Scenario, support: readonly typeof aircraft[number][] = []) => {
    const estimate = estimateAttack(scenario, state, republic, attackers, target, support);
    if (estimate.kind !== "battle") throw new Error("expected a battle");
    return estimate;
  };

  it("leaves the odds alone without planned support, with aircraft that are not the attacker's, or grounded ones", () => {
    expect(battle(open)).not.toHaveProperty("air");
    expect(battle(open, [unit("south-ju52-bombers")])).toEqual(battle(open));
    const rainy = { ...state, weather: { outcomes: Object.fromEntries((plainScenario.weather?.zones ?? []).map((zone) => [zone.id, "rain"])), roll: 10 } } as GameState;
    expect(estimateAttack(open, rainy, republic, attackers, target, aircraft)).not.toHaveProperty("air");
  });

  it("counts unopposed support in full, in the modifiers too", () => {
    const estimate = battle(open, aircraft);
    expect(estimate.air).toMatchObject({ chance: 1, modifier: { kind: "air-support", roll: 6 } });
    expect(estimate.air?.odds).toBeUndefined();
    expect(estimate.modifiers).toContainEqual(estimate.air?.modifier);
    expect(estimate.takeChance).toBeGreaterThan(battle(open).takeChance);
  });

  it("weighs the odds by the chance to win the air against the defenders' AA", () => {
    const plain = battle(guarded);
    const estimate = battle(guarded, aircraft);
    const air = estimate.air!;
    expect(air.odds).toEqual(airBattleOdds(air.input));
    expect(air.chance).toBe(air.odds?.attackerWins);
    expect(estimate.modifiers).toEqual(plain.modifiers);
    const sure = battle(open, aircraft);
    expect(estimate.takeChance).toBeCloseTo(plain.takeChance * (1 - air.chance) + sure.takeChance * air.chance, 10);
    const chances = [...estimate.chances.values()];
    expect(chances.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
  });
});

function raise(state: GameState, id: string, factionId: string, type: string, territoryId: string): GameState {
  const definition: RaisedUnitDefinition = { factionId: faction(factionId), fullStrength: 300, id: unit(id), name: id, type: type as UnitTypeId };
  return {
    ...state,
    raised: { ...state.raised, [id]: definition },
    units: { ...state.units, [id]: { factionId: faction(factionId), fatigue: 0, id: unit(id), morale: { demoralized: false, quietTurns: 0 }, strength: 300, territoryId: territory(territoryId) } }
  };
}
