import { describe, expect, it } from "vitest";
import { battleStreamTag, rollDie, seededBattleDice } from "../main/engine/dice";
import { deriveSeed, seededRandom } from "../main/engine/random";
import { standingOrder } from "../main/engine/orders";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import { type GameState, isMoveOrder, type Scenario, type TurnResolutionResult } from "../main/engine/types";
import { demoralizedAttackReason, legalDestinations, validateMoveOrder } from "../main/engine/validation";
import { advance, nextTurn } from "../main/state/coordinator";
import type { GameRecord, Session } from "../main/state/session";
import { type ArmySpec, armyIn, battlefield, battlesOf, city, faction, loadedDice, move, play, spainM2, territory, tiny, unit } from "./support";

const a = (id: string, factionId: string, where: string, extra: Partial<ArmySpec> = {}): ArmySpec => ({ faction: factionId, id, territory: where, ...extra });
const regiment = (id: string, factionId: string, where: string, extra: Partial<ArmySpec> = {}) => a(id, factionId, where, { type: "infantry-regiment", ...extra });
const at = (result: TurnResolutionResult, id: string) => result.finalState.units[unit(id)]?.territoryId;

/** Resolves `turns` turns with no orders, returning every result. */
function hold(scenario: Scenario, state: GameState, turns: number): readonly TurnResolutionResult[] {
  const results: TurnResolutionResult[] = [];
  let current = state;
  for (let turn = 0; turn < turns; turn += 1) {
    const result = resolveTurn(scenario, current, [], 1);
    results.push(result);
    current = result.finalState;
  }
  return results;
}

describe("M22 digging in (C7)", () => {
  it("gains one level per quiet turn up to the scenario's max, for the faction that holds", () => {
    const { scenario, state } = battlefield(tiny(), [a("b1", "blue", "harbor"), a("r1", "red", "westfold")]);
    const levels = hold(scenario, state, 3).map((result) => result.finalState.fortification[territory("harbor")]);
    expect(levels).toEqual([{ factionId: "blue", level: 1 }, { factionId: "blue", level: 2 }, { factionId: "blue", level: 2 }]);
    // Highlands and the Lowlands are controlled but empty, so nobody holds them.
    expect(Object.keys(hold(scenario, state, 1)[0]?.finalState.fortification ?? {})).toEqual(["westfold", "harbor"]);
  });

  it("gives the defenders their level as a roll modifier", () => {
    const { scenario, state } = battlefield(tiny(), [a("b1", "blue", "harbor"), a("r1", "red", "highlands"), a("r2", "red", "highlands")]);
    const [, second] = hold(scenario, state, 2);
    const dug = second?.finalState ?? state;
    const result = play(scenario, dug, [move("red", "r1", "highlands", "harbor"), move("red", "r2", "highlands", "harbor")], loadedDice([6]));
    expect(battlesOf(result)[0]?.modifiers).toEqual([
      { kind: "dug-in", level: 2, roll: -2 },
      { factionId: "blue", kind: "faction", modifierId: "harbor-batteries", name: "Harbor batteries", role: "defence", roll: -1 }
    ]);
  });

  it("keeps the level of a territory that was fought over", () => {
    const { scenario, state } = battlefield(tiny(), [a("b1", "blue", "harbor"), a("r1", "red", "highlands")], {
      state: { fortification: { [territory("harbor")]: { factionId: faction("blue"), level: 1 } } }
    });
    const result = play(scenario, state, [move("red", "r1", "highlands", "harbor")], loadedDice([1]));
    expect(battlesOf(result)[0]?.result).toBe("attacker-eliminated");
    expect(result.finalState.fortification[territory("harbor")]).toEqual({ factionId: "blue", level: 1 });
  });

  it("belongs to the territory: it stays while the faction holds and goes when it no longer does", () => {
    const works = { fortification: { [territory("harbor")]: { factionId: faction("blue"), level: 1 } } };
    const pair = battlefield(tiny(), [a("b1", "blue", "harbor"), a("b2", "blue", "harbor")], { state: works });
    const oneLeaves = play(pair.scenario, pair.state, [move("blue", "b1", "harbor", "isle")]);
    expect(oneLeaves.finalState.fortification[territory("harbor")]).toEqual({ factionId: "blue", level: 2 });
    // The army that left takes nothing with it.
    expect(oneLeaves.finalState.fortification[territory("isle")]).toBeUndefined();

    const allLeave = play(pair.scenario, pair.state, [move("blue", "b1", "harbor", "isle"), move("blue", "b2", "harbor", "lowlands")]);
    expect(allLeave.finalState.fortification[territory("harbor")]).toBeUndefined();
  });

  describe("needs an entrencher: a healthy army of the holder that stayed (O3)", () => {
    const works = { fortification: { [territory("harbor")]: { factionId: faction("blue"), level: 1 } } };

    it("digs in when one healthy army stays and another moves out", () => {
      const { scenario, state } = battlefield(tiny(), [a("b1", "blue", "harbor"), a("b2", "blue", "harbor")]);
      const result = play(scenario, state, [move("blue", "b2", "harbor", "isle")]);
      expect(result.finalState.fortification[territory("harbor")]).toEqual({ factionId: "blue", level: 1 });
    });

    it("does not dig in when the only armies that stayed are demoralized", () => {
      const { scenario, state } = battlefield(tiny(), [a("b1", "blue", "harbor", { demoralized: true }), a("b2", "blue", "harbor")], { state: works });
      const result = play(scenario, state, [move("blue", "b2", "harbor", "isle")]);
      expect(result.finalState.fortification[territory("harbor")]).toEqual({ factionId: "blue", level: 1 });
      // Resting still recovers the army (M23), so it can entrench next turn.
      expect(armyIn(result.finalState, "b1").morale).toEqual({ demoralized: false, quietTurns: 0 });
      const [next] = hold(scenario, result.finalState, 1);
      expect(next?.finalState.fortification[territory("harbor")]).toEqual({ factionId: "blue", level: 2 });
    });

    it("keeps the level when every army there moved, even if others arrived", () => {
      const { scenario, state } = battlefield(tiny(), [a("b1", "blue", "harbor"), a("b2", "blue", "isle")], { state: works });
      const result = play(scenario, state, [move("blue", "b1", "harbor", "isle"), move("blue", "b2", "isle", "harbor")]);
      expect(at(result, "b2")).toBe("harbor");
      expect(result.finalState.fortification[territory("harbor")]).toEqual({ factionId: "blue", level: 1 });
    });

    it("does not count an army disbanded for an impossible order", () => {
      const { scenario, state } = battlefield(tiny(), [a("b1", "blue", "harbor", { demoralized: true }), a("b2", "blue", "harbor")], { state: works });
      // Harbor and Westfold are not connected, so b2 is disbanded; only the demoralized b1 stays.
      const result = play(scenario, state, [move("blue", "b2", "harbor", "westfold")]);
      expect(result.finalState.units[unit("b2")]).toBeUndefined();
      expect(result.finalState.fortification[territory("harbor")]).toEqual({ factionId: "blue", level: 1 });
    });
  });

  it("is lost to the faction that takes the territory, which starts from nothing", () => {
    const { scenario, state } = battlefield(tiny(), [a("b1", "blue", "harbor", { strength: 40 }), a("r1", "red", "highlands"), a("r2", "red", "highlands")], {
      state: { fortification: { [territory("harbor")]: { factionId: faction("blue"), level: 1 } } }
    });
    const result = play(scenario, state, [move("red", "r1", "highlands", "harbor"), move("red", "r2", "highlands", "harbor")], loadedDice([6]));
    expect(battlesOf(result)[0]?.site).toMatchObject({ occupation: { factionId: "red", kind: "taken" } });
    expect(result.finalState.fortification[territory("harbor")]).toBeUndefined();
  });
});

describe("M23 morale (C6)", () => {
  const demoralizedRed = battlefield(tiny(), [a("r1", "red", "westfold", { demoralized: true }), a("b1", "blue", "lowlands"), a("r0", "red", "isle"), a("b0", "blue", "isle")]);

  it("cannot attack: it may enter only where no other faction stands, even beside its own armies", () => {
    const { scenario, state } = demoralizedRed;
    expect(validateMoveOrder(scenario, state, move("red", "r1", "westfold", "lowlands"))).toEqual({ ok: false, reason: demoralizedAttackReason });
    expect(validateMoveOrder(scenario, state, move("red", "r1", "westfold", "highlands"))).toEqual({ ok: true });
    expect(legalDestinations(scenario, state, faction("red"), [unit("r1")])).toEqual(["highlands"]);
    const nearIsle = battlefield(tiny(), [a("r1", "red", "harbor", { demoralized: true }), a("r0", "red", "isle"), a("b0", "blue", "isle")]);
    expect(legalDestinations(nearIsle.scenario, nearIsle.state, faction("red"), [unit("r1")])).toEqual(["highlands", "lowlands"]);
  });

  it("treats a demoralized army's attack order as impossible (M9)", () => {
    const { scenario, state } = demoralizedRed;
    const result = play(scenario, state, [move("red", "r1", "westfold", "lowlands")], loadedDice([1]));
    expect(result.outcomes.find((outcome) => outcome.kind === "invalid-order")).toMatchObject({ reason: demoralizedAttackReason });
    expect(result.finalState.units[unit("r1")]).toBeUndefined();
  });

  it("recovers after one quiet turn and is reported as recovered", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "westfold", { demoralized: true })]);
    const [result] = hold(scenario, state, 1);
    expect(result?.finalState.units[unit("r1")]?.morale).toEqual({ demoralized: false, quietTurns: 0 });
    expect(result?.outcomes.at(-1)).toEqual({ factionId: "red", kind: "recovered", territoryId: "westfold", unitId: "r1" });
  });

  it("restarts its clock when it moves", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "westfold", { demoralized: true, strength: 50 })]);
    const moved = play(scenario, state, [move("red", "r1", "westfold", "highlands")]);
    expect(armyIn(moved.finalState, "r1").morale).toEqual({ demoralized: true, quietTurns: 0 });
    expect(moved.outcomes.some((outcome) => outcome.kind === "recovered")).toBe(false);
    const [rested] = hold(scenario, moved.finalState, 1);
    expect(rested?.outcomes.filter((outcome) => outcome.kind === "recovered")).toHaveLength(1);
  });

  it("restarts its clock when it is demoralized again", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "highlands", { demoralized: true }), a("b1", "blue", "harbor"), a("b2", "blue", "harbor")]);
    // 8 against 3 is 2:1; a 3 demoralizes both sides, so r1 has no quiet turn.
    const result = play(scenario, state, [move("blue", "b1", "harbor", "highlands"), move("blue", "b2", "harbor", "highlands")], loadedDice([3]));
    expect(battlesOf(result)[0]).toMatchObject({ demoralizedUnitIds: ["b1", "r1"], result: "both-demoralized" });
    expect(armyIn(result.finalState, "r1").morale).toEqual({ demoralized: true, quietTurns: 0 });
    expect(result.outcomes.some((outcome) => outcome.kind === "recovered")).toBe(false);
  });
});

describe("M24 faction modifiers: popular resistance (C17)", () => {
  const madrid = (cityController: "republic" | "north") => {
    const base = battlefield(spainM2(), [regiment("r1", "republic", "madrid"), ...["n1", "n2", "n3"].map((id) => regiment(id, "north", "castilla-y-leon"))]);
    const state: GameState = { ...base.state, cityControl: { ...base.state.cityControl, [city("madrid")]: faction(cityController) } };
    return play(base.scenario, state, ["n1", "n2", "n3"].map((id) => move("north", id, "castilla-y-leon", "madrid")), loadedDice([4]));
  };

  it("helps the Republic defend a territory holding a city it controls", () => {
    expect(battlesOf(madrid("republic"))[0]?.modifiers).toEqual([
      { factionId: "republic", kind: "faction", modifierId: "popular-resistance", name: "Popular resistance", role: "defence", roll: -1 }
    ]);
  });

  it("does not apply when the Republic controlled no city there at the start of the turn", () => {
    expect(battlesOf(madrid("north"))[0]?.modifiers).toEqual([]);
  });

  it("does not help the Republic attack", () => {
    const { scenario, state } = battlefield(spainM2(), [regiment("r1", "republic", "castilla-la-mancha"), regiment("r2", "republic", "castilla-la-mancha"), regiment("n1", "north", "madrid")]);
    const battle = battlesOf(play(scenario, state, [move("republic", "r1", "castilla-la-mancha", "madrid"), move("republic", "r2", "castilla-la-mancha", "madrid")], loadedDice([4])))[0];
    expect(battle?.modifiers).toEqual([]);
  });

  it("applies in entry battles, which have no works", () => {
    const control = { ...initialGameState(tiny()).control, [territory("harbor")]: { factionIds: [faction("red"), faction("blue")], kind: "contested" as const } };
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "highlands"), a("b1", "blue", "lowlands"), a("b2", "blue", "lowlands")], {
      state: { control, fortification: { [territory("harbor")]: { factionId: faction("blue"), level: 2 } } }
    });
    const result = play(scenario, state, [move("red", "r1", "highlands", "harbor"), move("blue", "b1", "lowlands", "harbor"), move("blue", "b2", "lowlands", "harbor")], loadedDice([6]));
    expect(battlesOf(result)[0]).toMatchObject({ modifiers: [{ modifierId: "harbor-batteries", roll: -1 }, { kind: "odds-halving" }], site: { kind: "entry" } });
  });
});

describe("M25 no recovery of men (C13)", () => {
  it("never restores men lost to attrition", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "westfold"), a("b1", "blue", "lowlands", { strength: 60 })]);
    const fought = play(scenario, state, [move("red", "r1", "westfold", "lowlands")], loadedDice([1]));
    expect(armyIn(fought.finalState, "r1").strength).toBe(25);
    expect(hold(scenario, fought.finalState, 3).map((result) => armyIn(result.finalState, "r1").strength)).toEqual([25, 25, 25]);
  });
});

describe("M26 resolution order and dice", () => {
  it("indexes meeting battles first, then territory battles by territory id, then standing battles", () => {
    const { scenario, state } = battlefield(spainM2(), [
      regiment("n1", "north", "aragon"), regiment("n2", "north", "aragon"), regiment("r1", "republic", "catalunya"),
      regiment("n4", "north", "galicia"), regiment("r3", "republic", "asturias"),
      regiment("r2", "republic", "valencia"), regiment("s1", "south", "murcia"),
      regiment("r4", "republic", "andalucia"), regiment("s2", "south", "andalucia")
    ]);
    const result = play(scenario, state, [
      move("south", "s1", "murcia", "valencia"),
      move("republic", "r3", "asturias", "galicia"),
      move("north", "n1", "aragon", "catalunya"), move("north", "n2", "aragon", "catalunya"),
      move("republic", "r1", "catalunya", "aragon")
    ], loadedDice([3, 2, 4, 5]));
    expect(battlesOf(result).map((battle) => [battle.site.kind, battle.site.kind === "meeting" ? battle.site.between.join("|") : battle.site.territoryId, battle.die])).toEqual([
      ["meeting", "aragon|catalunya", 3],
      ["assault", "galicia", 2],
      ["assault", "valencia", 4],
      ["standing", "andalucia", 5]
    ]);
  });

  it("orders meetings that share their lower territory id by attacking faction, then by the other id", () => {
    const { scenario, state } = battlefield(tiny(), [
      a("r1", "red", "lowlands"), a("r2", "red", "lowlands"), a("b2", "blue", "harbor"),
      a("r3", "red", "highlands"), a("r4", "red", "highlands"), a("b1", "blue", "harbor")
    ], { state: { control: { ...initialGameState(tiny()).control, [territory("lowlands")]: { factionIds: [faction("red"), faction("blue")], kind: "contested" } } } });
    // The Lowlands are contested, so Blue's move there is an advance, not a reinforcement.
    const result = play(scenario, state, [
      move("red", "r1", "lowlands", "harbor"), move("red", "r2", "lowlands", "harbor"), move("blue", "b2", "harbor", "lowlands"),
      move("red", "r3", "highlands", "harbor"), move("red", "r4", "highlands", "harbor"), move("blue", "b1", "harbor", "highlands")
    ], loadedDice([3, 3]));
    expect(battlesOf(result).map((battle) => [battle.site.kind === "meeting" ? battle.site.between : [], battle.die])).toEqual([
      [["highlands", "harbor"], 3],
      [["lowlands", "harbor"], 3]
    ]);
  });

  it("rolls each battle's die from deriveSeed(seed, battle stream, turn, index), apart from the computer players' streams", () => {
    const scenario = spainM2();
    const state = { ...initialGameState(scenario), turnNumber: 3 };
    const result = resolveTurn(scenario, state, [], 9);
    expect(battlesOf(result).map((battle) => battle.die)).toEqual([0, 1].map((index) => rollDie(seededRandom(deriveSeed(9, battleStreamTag, 3, index)))));
    expect(resolveTurn(scenario, state, [], 9, seededBattleDice(9, 3))).toEqual(result);
    expect(deriveSeed(9, battleStreamTag, 3, 0)).not.toBe(deriveSeed(9, 3, 0));
  });

  it("replays a whole game identically from the same seed and orders", () => {
    const run = (seed: number) => playGame(spainM2(), seed, 12).map((entry) => entry.result);
    expect(run(5)).toEqual(run(5));
    expect(run(5)).not.toEqual(run(6));
  });
});

describe("M27 standing battles in shared territories (D29)", () => {
  it("makes the faction with the greatest attack attack the other where they stand, without works", () => {
    const scenario = spainM2();
    const start = initialGameState(scenario);
    const state: GameState = { ...start, fortification: { [territory("andalucia")]: { factionId: faction("republic"), level: 2 } } };
    // South 18 against the Republic's 6 is 3:1, less popular resistance (Malaga); a 4 drives it out.
    const result = resolveTurn(scenario, state, [], 1, loadedDice([4, 4]));
    const [andalucia] = battlesOf(result);
    expect(andalucia).toMatchObject({
      attackerFactionId: "south",
      attacker: { value: 18 },
      defender: { armies: [{ from: "andalucia", unitId: "rep-vitoria-8", value: 6 }] },
      modifiers: [{ kind: "faction", modifierId: "popular-resistance", roll: -1 }],
      result: "defender-demoralized",
      // Murcia holds a Republican regiment; Castilla-La Mancha does not.
      retreats: [{ from: "andalucia", to: "murcia", unitId: "rep-vitoria-8" }],
      site: { kind: "standing", occupation: { factionId: "south", kind: "taken" }, territoryId: "andalucia", tieBreaks: [] }
    });
    expect(result.finalState.control[territory("andalucia")]).toEqual({ factionId: "south", kind: "controlled" });
    expect(result.finalState.cityControl[city("malaga")]).toBe("south");
    expect(result.finalState.fortification[territory("andalucia")]).toBeUndefined();
  });

  it("keeps a losing attacker where it stands", () => {
    const result = resolveTurn(spainM2(), initialGameState(spainM2()), [], 1, loadedDice([1, 4]));
    const [andalucia] = battlesOf(result);
    // Demoralized from the weakest up until they carry half of 18: Granada (fewest men), Lepanto, Cadiz.
    expect(andalucia).toMatchObject({ demoralizedUnitIds: ["south-granada-6", "south-lepanto-5", "south-cadiz-33"], result: "attacker-demoralized", retreats: [] });
    expect(["south-granada-6", "south-lepanto-5", "south-cadiz-33", "south-africa-vanguard", "rep-vitoria-8"].map((id) => at(result, id))).toEqual(["andalucia", "andalucia", "andalucia", "andalucia", "andalucia"]);
  });

  it("lets only armies that are not demoralized attack", () => {
    const start = initialGameState(spainM2());
    const state: GameState = {
      ...start,
      units: Object.fromEntries(Object.values(start.units).map((army) => [army.id, army.factionId === "north" && army.territoryId === "asturias" ? { ...army, morale: { demoralized: true, quietTurns: 0 } } : army]))
    };
    const asturias = battlesOf(resolveTurn(spainM2(), state, [], 1, loadedDice([4, 6])))[1];
    expect(asturias).toMatchObject({
      attacker: { armies: [{ unitId: "rep-asturian-militia", value: 3 }] },
      attackerFactionId: "republic",
      defender: { value: 9 },
      modifiers: [{ kind: "odds-halving" }],
      site: { territoryId: "asturias" }
    });
  });

  it("fights no standing battle when no faction there can attack", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "isle", { demoralized: true }), a("b1", "blue", "isle", { demoralized: true })]);
    expect(battlesOf(play(scenario, state, []))).toEqual([]);
  });

  it("breaks a tie for greatest attack with a seeded roll, recorded in the battle", () => {
    const { scenario, state } = battlefield(tiny(), [a("r1", "red", "isle"), a("b1", "blue", "isle")]);
    const first = battlesOf(play(scenario, state, [], loadedDice([3], [0])))[0];
    expect(first).toMatchObject({ attackerFactionId: "blue", site: { kind: "standing", tieBreaks: [{ factionIds: ["blue", "red"], role: "attack", roll: 1 }] } });
    const second = battlesOf(play(scenario, state, [], loadedDice([3], [0.99])))[0];
    expect(second).toMatchObject({ attackerFactionId: "red", site: { tieBreaks: [{ factionIds: ["blue", "red"], role: "attack", roll: 2 }] } });
  });

  it("breaks a tie for the defender the same way when three factions share a territory", () => {
    const { scenario, state } = battlefield(spainM2(), [regiment("r1", "republic", "la-rioja"), regiment("r2", "republic", "la-rioja"), regiment("n1", "north", "la-rioja"), regiment("s1", "south", "la-rioja")]);
    const battle = battlesOf(play(scenario, state, [], loadedDice([3])))[0];
    expect(battle).toMatchObject({ attackerFactionId: "republic", defender: { armies: [{ unitId: "n1" }] }, site: { tieBreaks: [{ factionIds: ["north", "south"], role: "defence", roll: 1 }] } });
  });

  it("counts as a battle fought there, so the holder does not dig in", () => {
    const { scenario, state } = battlefield(tiny(), [a("b1", "blue", "harbor"), a("r1", "red", "harbor", { strength: 50 })], {
      state: { fortification: { [territory("harbor")]: { factionId: faction("blue"), level: 1 } } }
    });
    const result = play(scenario, state, [], loadedDice([1]));
    // Blue attacks, so its batteries (a defence bonus) do not apply, and nobody's works count.
    expect(battlesOf(result)[0]).toMatchObject({ attackerFactionId: "blue", modifiers: [], site: { kind: "standing" } });
    expect(result.finalState.fortification[territory("harbor")]).toEqual({ factionId: "blue", level: 1 });
  });
});

describe("M7 control after battles", () => {
  it("hands a taken territory and its cities to the attacker", () => {
    const { scenario, state } = battlefield(tiny(), [a("b1", "blue", "harbor", { strength: 40 }), a("r1", "red", "highlands"), a("r2", "red", "highlands")]);
    const result = play(scenario, state, [move("red", "r1", "highlands", "harbor"), move("red", "r2", "highlands", "harbor")], loadedDice([6]));
    expect(result.controlChanges).toEqual([{ after: { factionId: "red", kind: "controlled" }, before: { factionId: "blue", kind: "controlled" }, territoryId: "harbor" }]);
    expect(result.cityChanges).toEqual([{ after: "red", before: "blue", cityId: "port-town" }]);
  });
});

/** Plays an all-computer game through the real coordinator, keeping each turn's start state. */
function playGame(scenario: Scenario, seed: number, turns: number): readonly { readonly result: TurnResolutionResult; readonly start: GameState }[] {
  const assignments = Object.fromEntries(scenario.factions.map((entry) => [entry.id, "computer" as const]));
  let record: GameRecord = { assignments, history: [], locked: {}, scenarioId: scenario.id, seed, state: initialGameState(scenario) };
  let session: Session = advance(scenario, record);
  const played: { readonly result: TurnResolutionResult; readonly start: GameState }[] = [];
  for (let turn = 1; turn <= turns; turn += 1) {
    if (session.phase !== "resolution" && session.phase !== "game-over") throw new Error(`Unexpected ${session.phase}`);
    played.push({ result: session.result, start: record.state });
    if (session.phase === "game-over") break;
    record = { ...session.game, state: { ...session.game.state, turnNumber: session.game.state.turnNumber + 1 } };
    session = nextTurn(scenario, session.game, session.result.outcomes);
  }
  return played;
}

describe("turn invariants over seeded computer games", () => {
  const games = [1, 2, 3, 4, 5, 6].flatMap((seed) => playGame(spainM2(), seed, 15));

  it("reports every valid move once: as a move, or through the battles its army fought", () => {
    for (const { result } of games) {
      const invalid = new Set(result.outcomes.flatMap((outcome) => (outcome.kind === "invalid-order" ? [outcome.order.unitId] : [])));
      const moveOutcomes = result.outcomes.flatMap((outcome) => (outcome.kind !== "battle" && "order" in outcome && outcome.kind !== "invalid-order" && "unitId" in outcome.order ? [outcome.order.unitId] : []));
      expect(new Set(moveOutcomes).size).toBe(moveOutcomes.length);
      const inBattle = new Set(battlesOf(result).flatMap((battle) => [...battle.attacker.armies, ...battle.defender.armies].map((army) => army.unitId)));
      for (const order of result.submittedOrders.filter(isMoveOrder).filter((candidate) => !invalid.has(candidate.unitId))) {
        expect(moveOutcomes.includes(order.unitId) || inBattle.has(order.unitId)).toBe(true);
      }
    }
  });

  it("accounts for every army: it is still in play, or was destroyed, surrendered, or disbanded", () => {
    for (const { result, start } of games) {
      const gone = new Set([
        ...battlesOf(result).flatMap((battle) => [...battle.losses.filter((loss) => loss.destroyed).map((loss) => loss.unitId), ...battle.surrenderedUnitIds]),
        ...result.outcomes.flatMap((outcome) => (outcome.kind === "invalid-order" || outcome.kind === "disbanded-move" ? [outcome.order.unitId] : []))
      ]);
      for (const id of Object.keys(start.units)) {
        expect(result.finalState.units[unit(id)] !== undefined || gone.has(unit(id))).toBe(true);
      }
      // R5, R7 (m3-modular): Replenish raises men, and recruits appear; M25 holds for every other army.
      const raisedOrReplenished = new Set(result.outcomes.flatMap((outcome) =>
        outcome.kind === "training-completed" ? [outcome.unitId] : outcome.kind === "replenish-applied" ? [outcome.order.unitId] : []));
      for (const army of Object.values(result.finalState.units)) {
        if (!raisedOrReplenished.has(army.id)) expect(army.strength).toBeLessThanOrEqual(armyIn(start, army.id).strength);
        expect(army.strength).toBeGreaterThan(0);
      }
      for (const works of Object.values(result.finalState.fortification)) {
        expect(works.level).toBeLessThanOrEqual(spainM2().combat.diggingIn.max);
      }
    }
  });
});

describe("standing orders: Entrench and Rest (O1, O2, O5)", () => {
  it("entrenches a healthy army and rests a demoralized one", () => {
    expect(standingOrder({ morale: { demoralized: false, quietTurns: 0 } })).toBe("entrench");
    expect(standingOrder({ morale: { demoralized: true, quietTurns: 0 } })).toBe("rest");
  });
});
