import { describe, expect, it } from "vitest";
import { type BattleOdds, battleOdds } from "../../main/engine/d20/odds";
import { aircraftLost, airBattle, airBattleFought, airBattleOdds, groundSupport } from "../../main/engine/air/airBattle";
import {
  airBattleAircraft,
  airBattleInput,
  airBattleDie,
  airOverBattle,
  airOverHookedBattle,
  antiAirOf,
  flightsAfter,
  supportModifiersOf
} from "../../main/engine/air/groundSupport";
import { emptyAirScratch } from "../../main/engine/air/scratch";
import { carryScale } from "../../main/engine/carry";
import { turnCasualties } from "../../main/engine/casualties";
import { pick, rollStream, seededRollStreams } from "../../main/engine/dice";
import { initialGameState, resolveTurn } from "../../main/engine/resolution";
import type {
  AirBattleAircraft,
  AirBattleInput,
  AirBattleRow,
  AirMission,
  AirMissionOrder,
  FactionId,
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
  const table = spainWithAir().air!.battleTable;
  const fighter = plane("f", "patrol", 2);
  const bomber = plane("b", "support", 1, 3);

  it("adds the attacker's air rolls to one d20, less the defender's and its AA, and reads the table", () => {
    const both = input([bomber], [{ ...fighter, factionId: republic }], 3);
    expect(airBattle(table, both, 12)).toEqual({ die: 12, modifier: -4, row: table[1], score: 8 });
    expect(airBattle(table, input([bomber, fighter], []), 10)).toEqual({ die: 10, modifier: 3, row: table[3], score: 13 });
  });

  it("keeps the score within 0 to 20", () => {
    expect(airBattle(table, input([bomber], [{ ...fighter, factionId: republic }], 3), 1)).toMatchObject({ row: table[0], score: 0 });
    expect(airBattle(table, input([fighter, bomber], []), 20)).toMatchObject({ modifier: 3, row: table[4], score: 20 });
    expect(() => airBattle([], input([fighter], []), 5)).toThrow(/no air battle row for score 7/u);
  });

  it("gives every row's exact chance over the d20's faces", () => {
    const even = input([fighter], [fighter]);
    expect(airBattleOdds(table, even).map(({ chance }) => chance)).toEqual([3 / 20, 5 / 20, 4 / 20, 5 / 20, 3 / 20]);
    expect(airBattleOdds(table, even).map(({ row }) => row)).toEqual(table);
    // +1: a 1 and a 2 stay in the first row, and the 20 is kept at 20.
    expect(airBattleOdds(table, input([bomber], [])).map(({ chance }) => chance)).toEqual([2 / 20, 5 / 20, 4 / 20, 5 / 20, 4 / 20]);
  });

  it("is fought when both sides have aircraft over the battle, or the attacker's Ground Support faces AA", () => {
    expect(airBattleFought(input([fighter], [fighter]))).toBe(true);
    expect(airBattleFought(input([bomber], [], 3))).toBe(true);
    expect(airBattleFought(input([bomber], []))).toBe(false);
    // A Patrol alone does not face AA, and the defender's own support never does.
    expect(airBattleFought(input([fighter], [], 3))).toBe(false);
    expect(airBattleFought(input([], [bomber], 3))).toBe(false);
  });

  it("gives Ground Support to the side the row names, whole, to nobody in a contested sky, and to both with no air battle", () => {
    const sides = input([bomber, plane("c", "support", 1, 4)], [plane("d", "support", 1, 3, republic), plane("e", "patrol", 2, 0, republic)]);
    const roll = (row: AirBattleRow | undefined) => { const { attacker, defender } = groundSupport(sides, row); return [attacker.roll, defender.roll]; };
    expect(table.map(roll)).toEqual([[0, 3], [0, 3], [0, 0], [7, 0], [7, 0]]);
    expect(roll(undefined)).toEqual([7, 3]);
    expect(groundSupport(sides, table[3]).attacker.unitIds).toEqual([unit("c"), unit("b")]);
    expect(groundSupport(sides, table[1]).attacker).toEqual({ roll: 0, unitIds: [] });
    expect(groundSupport(sides, table[4]).defender).toEqual({ roll: 0, unitIds: [] });
  });

  it("costs the loser one aircraft only where the winner commands the air", () => {
    const sides = input([bomber], [plane("e", "patrol", 2, 0, republic)]);
    expect(table.map((row) => aircraftLost(sides, row))).toEqual([[unit("b")], [], [], [], [unit("e")]]);
    expect(table.map(({ name, support, aircraftLost: lost, upTo }) => [name, support, lost.attacker, lost.defender, upTo])).toEqual([
      ["Defender commands the air", "defender", 1, 0, 3],
      ["Defender holds the edge", "defender", 0, 0, 8],
      ["Contested sky", "none", 0, 0, 12],
      ["Attacker holds the edge", "attacker", 0, 0, 17],
      ["Attacker commands the air", "attacker", 0, 1, 20]
    ]);
    // Only anti-air over the battle: the defender has no aircraft to lose.
    expect(aircraftLost(input([bomber], [], 3), table[4]!)).toEqual([]);
  });

  it("takes the weakest in the air first, then the greatest Ground Support, then id order, whatever the mission", () => {
    const row = (attacker: number, defender = 0): AirBattleRow => ({ aircraftLost: { attacker, defender }, name: "Row", support: "attacker", upTo: 20 });
    const sides = input([fighter, plane("d", "support", 1, 3), plane("c", "support", 1, 3), plane("a", "support", 1, 2), plane("p", "patrol", 1)], [plane("z", "patrol", 2, 0, republic)]);
    expect(aircraftLost(sides, row(9))).toEqual(["c", "d", "a", "p", "f"].map(unit));
    expect(aircraftLost(sides, row(1, 2))).toEqual([unit("c"), unit("z")]);
    // A side that wins and still loses aircraft has the support of those it has left.
    expect(groundSupport(sides, row(2)).attacker).toEqual({ roll: 2, unitIds: [unit("a")] });
  });

  it("counts at most `supportMax` aircraft, best first then by id, and nothing from Patrol", () => {
    const many = [plane("c", "support", 1, 3), plane("a", "support", 1, 3), plane("z", "support", 1, 4), plane("p", "patrol", 2), plane("n", "support", 1, 0)];
    expect(groundSupport(input(many, [], 0, 2), undefined).attacker).toEqual({ roll: 7, unitIds: [unit("z"), unit("a")] });
    expect(groundSupport(input(many, []), undefined).attacker).toEqual({ roll: 10, unitIds: [unit("z"), unit("a"), unit("c")] });
    expect(groundSupport(input([plane("x", "support", 1, 3), plane("x", "support", 1, 3)], [], 0, 1), undefined).attacker.unitIds).toEqual([unit("x")]);
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
    expect(airOverBattle(scenario, input([], []), () => 15)).toBeUndefined();
    const lone = airOverBattle(scenario, input([plane("b", "support", 1, 3)], []), () => { throw new Error("no roll without an air battle"); });
    expect(lone).toEqual({ aircraftLost: [], input: input([plane("b", "support", 1, 3)], []), support: { attacker: { roll: 3, unitIds: [unit("b")] }, defender: { roll: 0, unitIds: [] } } });
    const guarded = input([plane("b", "support", 1, 3)], [], 3);
    const fought = airOverBattle(scenario, guarded, () => 15);
    expect(fought?.result).toEqual({ die: 15, modifier: -2, row: scenario.air?.battleTable[3], score: 13 });
    expect(fought?.support.attacker.roll).toBe(3);
    expect(fought?.aircraftLost).toEqual([]);
    expect(airOverBattle(scenario, guarded, () => 14)).toMatchObject({ aircraftLost: [], support: { attacker: { roll: 0, unitIds: [] } } });
    expect(airOverBattle(scenario, guarded, () => 5)?.aircraftLost).toEqual([unit("b")]);
    // A scenario without an air block has no table to fight on.
    const airless = { ...scenario };
    delete airless.air;
    expect(airOverBattle(airless, guarded, () => 14)).not.toHaveProperty("result");
  });

  it("rolls each battle's one d20 on the air-battle stream of its index", () => {
    const die = pick(rollStream(11, "air-battle", 4, 2), 20);
    expect(airBattleDie({ ...emptyAirScratch, streams: seededRollStreams(11, 4) }, 2)).toBe(die);
    expect(airBattleDie(emptyAirScratch, 0)).toBe(1);
  });

  it("leaves the aircraft an air battle shot down out of the turn's later flights", () => {
    const flights = { ...emptyAirScratch, patrols: [mission("republic", "p", { kind: "patrol", territoryId: madrid })], support: ["b", "c"].map((id) => mission("north", id, { kind: "support", territoryId: madrid })) };
    const air = airOverBattle(scenario, input([plane("b", "support", 1, 3)], [], 3), () => 5)!;
    expect(flightsAfter(flights, air)).toEqual({ ...flights, support: [flights.support[1]] });
    expect(flightsAfter(flights, { ...air, aircraftLost: [unit("p")] })).toEqual({ ...flights, patrols: [] });
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
    expect(supportModifiersOf({ aircraftLost: [], input: sides, support: groundSupport(sides, undefined) })).toEqual([
      { factionId: north, kind: "air-support", role: "attack", roll: 3, unitIds: [unit("b")] },
      { factionId: "south", kind: "air-support", role: "defence", roll: -3, unitIds: [unit("d")] }
    ]);
    expect(supportModifiersOf({ aircraftLost: [], input: sides, support: { attacker: { roll: 0, unitIds: [] }, defender: { roll: 0, unitIds: [] } } })).toEqual([]);
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

  it("fights it on its own stream with one d20, reports it, and gives Ground Support and loses aircraft as its row says", () => {
    const seen = new Map<string, readonly unknown[]>();
    for (let seed = 1; seed <= 60; seed += 1) {
      const result = resolveTurn(scenario, state, [{ factionId: republic, orders: [...attack, ...support] }], seed);
      const [airBattleOutcome] = of(result.outcomes, "air-battle");
      const [battle] = of(result.outcomes, "battle");
      if (airBattleOutcome === undefined || battle === undefined) throw new Error("expected an air battle over the battle");
      const { die, modifier, row, score } = airBattleOutcome.result;
      expect(die).toBe(pick(rollStream(seed, "air-battle", state.turnNumber, airBattleOutcome.battleIndex), 20));
      // Fighter 2 and bomber 1 against the battery's AA of 3.
      expect([modifier, score]).toEqual([0, die]);
      const roll = row.support === "attacker" ? 6 : 0;
      // The bomber is the weaker in the air; the battery's side has no aircraft to lose.
      const lost = row.aircraftLost.attacker === 0 ? [] : [unit("rep-breguet-bombers")];
      const air = battle.modifiers.filter((each) => each.kind === "air-support");
      expect(air).toEqual(roll === 0 ? [] : [{ factionId: republic, kind: "air-support", role: "attack", roll, unitIds: [unit("rep-breguet-bombers"), unit("rep-ni52-fighters")] }]);
      expect(airBattleOutcome.support.attacker.roll).toBe(roll);
      expect(of(result.outcomes, "air-support").map((outcome) => outcome.applied)).toEqual([roll > 0, roll > 0]);
      expect(airBattleOutcome.aircraftLost).toEqual(lost);
      expect(result.finalState.units[unit("rep-breguet-bombers")] === undefined).toBe(lost.length > 0);
      expect(result.finalState.units[unit("rep-ni52-fighters")]).toBeDefined();
      seen.set(row.name, [roll, lost.length]);
    }
    expect(Object.fromEntries(seen)).toEqual({
      "Attacker commands the air": [6, 0], "Attacker holds the edge": [6, 0], "Contested sky": [0, 0], "Defender commands the air": [0, 1], "Defender holds the edge": [0, 0]
    });
  });

  /** The scenario with one row for every score. */
  const withRow = (row: Omit<AirBattleRow, "name" | "upTo">): Scenario => ({ ...scenario, air: { ...scenario.air!, battleTable: [{ ...row, name: "Row", upTo: 20 }] } });

  it("balances the books: the lost aircraft is gone from the turn it was lost in, with no men, no refund and no upkeep", () => {
    const play = (attacker: number) => resolveTurn(withRow({ aircraftLost: { attacker, defender: 0 }, support: "defender" }), state, [{ factionId: republic, orders: [...attack, ...support] }], 7);
    const kept = play(0);
    const lost = play(1);
    const gone = unit("rep-breguet-bombers");
    const bomber = scenario.index.unitTypes.get(scenario.index.units.get(gone)!.type)!;
    // Everything on the board is as it would be, but for the one aircraft.
    const { [gone]: plane, ...others } = kept.finalState.units;
    expect(plane).toBeDefined();
    expect(lost.finalState.units).toEqual(others);
    // Aircraft have no men to lose: the casualties are the battle's, both ways.
    expect(lost.finalState.casualties).toEqual(kept.finalState.casualties);
    expect(turnCasualties(scenario, state, lost.outcomes)).toEqual(turnCasualties(scenario, state, kept.outcomes));
    // Its upkeep is no longer paid, and nothing comes back.
    const treasury = ({ finalState: { carry, treasuries } }: typeof kept, factionId: FactionId) =>
      Object.fromEntries(scenario.resources.map(({ id }) => [id, (treasuries[factionId]?.[id] ?? 0) * carryScale - (carry?.[factionId]?.[id] ?? 0)]));
    const saved = Object.fromEntries(scenario.resources.map(({ id }) => [id, (treasury(lost, republic)[id] ?? 0) - (treasury(kept, republic)[id] ?? 0)]));
    expect(saved).toEqual(Object.fromEntries(scenario.resources.map(({ id }) => [id, Math.round((bomber.upkeep[id] ?? 0) * carryScale)])));
    expect(Object.values(saved).some((amount) => amount > 0)).toBe(true);
    expect(treasury(lost, north)).toEqual(treasury(kept, north));
    // It neither comes back to its base nor is reported lost with one; the air battle names it.
    expect(of(lost.outcomes, "air-battle")[0]?.aircraftLost).toEqual([gone]);
    expect(of(kept.outcomes, "air-battle")[0]?.aircraftLost).toEqual([]);
    expect([...of(lost.outcomes, "aircraft-lost"), ...of(lost.outcomes, "aircraft-rebased")]).toEqual([]);
    // Next turn it has no orders to give.
    expect(resolveTurn(scenario, lost.finalState, [{ factionId: republic, orders: [support[0]!] }], 8).outcomes.map(({ kind }) => kind)).toContain("rejected-order");
  });

  it("keeps an aircraft shot down over one battle out of the next one there, the same turn", () => {
    // Army of the North and Army of the South attack Madrid apart; each has a bomber over it, against the Republic's one fighter.
    let board = raise(initialGameState(scenario), "n-infantry", "north", "infantry-regiment", "castilla-y-leon");
    board = raise(board, "s-infantry", "south", "infantry-regiment", "castilla-la-mancha");
    board = raise(board, "n-bomber", "north", "bomber-squadron", "castilla-y-leon");
    const madrid = territory("madrid");
    const defender = mission("republic", "rep-ni52-fighters", { kind: "patrol", territoryId: madrid });
    const submissions = [
      { factionId: north, orders: [move("north", "n-infantry", "castilla-y-leon", "madrid"), mission("north", "n-bomber", { kind: "support", territoryId: madrid })] },
      { factionId: republic, orders: [defender] },
      { factionId: faction("south"), orders: [move("south", "s-infantry", "castilla-la-mancha", "madrid"), mission("south", "south-ju52-bombers", { kind: "support", territoryId: madrid })] }
    ];
    const here = ({ site }: Extract<TurnOutcome, { kind: "battle" }>) => site.kind !== "meeting" && site.territoryId === madrid;
    const fly = (lost: number) => resolveTurn(withRow({ aircraftLost: { attacker: 0, defender: lost }, support: "attacker" }), board, submissions, 3);
    const spared = fly(0);
    expect(of(spared.outcomes, "battle").filter(here)).toHaveLength(2);
    expect(of(spared.outcomes, "air-battle").map(({ input: { defender: side } }) => side.aircraft.map(({ unitId }) => unitId))).toEqual([[defender.unitId], [defender.unitId]]);
    const shot = fly(1);
    const [first, ...rest] = of(shot.outcomes, "air-battle");
    expect(first?.aircraftLost).toEqual([defender.unitId]);
    // Nobody is left over the second battle, so its attacker's support goes unopposed.
    expect(rest).toEqual([]);
    expect(of(shot.outcomes, "battle").filter(here).map(({ modifiers }) => modifiers.filter(({ kind }) => kind === "air-support").map(({ roll }) => roll))).toEqual([[3], [3]]);
    expect(shot.finalState.units[defender.unitId]).toBeUndefined();
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
    expect(estimate.air).toMatchObject({ average: 6, lossChance: 0, modifier: { kind: "air-support", roll: 6 }, supportChance: 1 });
    expect(estimate.air).not.toHaveProperty("results");
    expect(estimate.modifiers).toContainEqual(estimate.air?.modifier);
    expect(estimate.takeChance).toBeGreaterThan(battle(open).takeChance);
  });

  it("weighs the odds over every row of the table against the defenders' AA", () => {
    const plain = battle(guarded);
    const estimate = battle(guarded, aircraft);
    const air = estimate.air!;
    // Fighter 2 and bomber 1 against AA of 3: the die alone decides.
    expect(air.results?.map(({ aircraftLost: lost, chance, roll, support }) => [chance, support, roll, lost])).toEqual([
      [0.15, "defender", 0, 1], [0.25, "defender", 0, 0], [0.2, "none", 0, 0], [0.25, "attacker", 6, 0], [0.15, "attacker", 6, 0]
    ]);
    expect(air.results?.map(({ name }) => name)).toEqual(guarded.air?.battleTable.map((row) => row.name));
    expect([air.average, air.supportChance, air.lossChance]).toEqual([2.4, 0.4, 0.15]);
    expect(estimate.modifiers).toEqual(plain.modifiers);
    // battleOdds adds the odds' own modifiers itself.
    const situational = plain.modifiers.filter(({ kind }) => kind !== "odds-halving" && kind !== "odds-overflow");
    const at = (roll: number) => battleOdds(guarded.d20, estimate.attacker.value, estimate.defender.value, [...situational, { ...air.modifier, roll }]);
    const weighed = (of: (odds: BattleOdds) => number) => 0.6 * of(at(0)) + 0.4 * of(at(6));
    expect(estimate.takeChance).toBeCloseTo(weighed((odds) => odds.takeChance), 10);
    expect(estimate.gainChance).toBeCloseTo(weighed((odds) => odds.gainChance), 10);
    expect(estimate.expected.attackerLoss).toBeCloseTo(weighed((odds) => odds.expected.attackerLoss), 10);
    const chances = [...estimate.chances.values()];
    expect(chances.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
    for (const [id, chance] of estimate.chances) expect(chance).toBeCloseTo(weighed((odds) => odds.chances.get(id) ?? 0), 10);
  });
});

function raise(state: GameState, id: string, factionId: string, type: string, territoryId: string): GameState {
  const definition: RaisedUnitDefinition = { factionId: faction(factionId), fullStrength: 300, id: unit(id), type: type as UnitTypeId };
  return {
    ...state,
    raised: { ...state.raised, [id]: definition },
    units: { ...state.units, [id]: { factionId: faction(factionId), fatigue: 0, id: unit(id), morale: { demoralized: false, quietTurns: 0 }, strength: 300, territoryId: territory(territoryId) } }
  };
}
