import { describe, expect, it } from "vitest";
import { initialGameState } from "../main/engine/resolution";
import { battleResults, type D6BattleOutcome, type GameState, type MoveOrder, type Scenario } from "../main/engine/types";
import { legendEntries } from "../main/map/MapLegend";
import { placeOddsPlaques } from "../main/map/DestinationOddsLayer";
import { battleRoutes, groupRoutes } from "../main/map/routes";
import { staticMapView } from "../main/map/view";
import {
  armyFigures,
  counterLabel,
  groupOrdersDescription,
  demoralizedRule,
  figuresDescription,
  menLabel,
  strengthShare,
  valuesLabel
} from "../main/presentation/army";
import { affectedFaction, attackLeft, battleKind, changedHands, claimants, decisiveBattle, groupBattles, groupTerritory, sideFactions, sideLosses } from "../main/presentation/battle";
import { battleSummary, cardFlavor, columnLabel, flavorSeed, flavorValues, formatMen, lostArmies, occupationLine, rawRow, sentenceCase } from "../main/presentation/battleText";
import { ruleNote } from "../main/presentation/battleRules";
import {
  chanceTone,
  type DestinationEstimate,
  destinationEstimates,
  modifierName,
  modifierPhrase,
  oddsSummary,
  percent,
  plannedEstimates,
  signed
} from "../main/presentation/odds";
import { artLevel } from "../main/presentation/outcomeArt";
import { outcomeKeys } from "../main/presentation/outcomes";
import { outcomeLine } from "../main/presentation/outcomeText";
import { territoryName } from "../main/presentation/text";
import {
  army,
  battle,
  contestedEntry,
  madridRepulsed,
  roadMeeting,
  side,
  spainShowcaseOutcomes,
  standingBattle,
  surrenderAfterBattle,
  threeSidedAssault
} from "./battleFixtures";
import { armyIn, battlefield, faction, move, spain, territory, tiny, unit, unitType, withUnits } from "./support";

function shaken(state: GameState, id: string, change: Partial<GameState["units"][keyof GameState["units"]]> = {}): GameState {
  const current = armyIn(state, id);
  return { ...state, units: { ...state.units, [current.id]: { ...current, morale: { demoralized: true, quietTurns: 0 }, ...change } } };
}

function group(outcomes: readonly D6BattleOutcome[]) {
  const [first] = groupBattles(outcomes);
  if (first === undefined) throw new Error("no group");
  return first;
}

describe("army figures (C4, C5, C6)", () => {
  it("prints the values that fight, the full values when they differ, and the men", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    const full = armyFigures(scenario, state, armyIn(state, "rep-wad-ras-1"));
    expect(full).toMatchObject({ attack: 4, defence: 6, demoralized: false, fullAttack: 4, fullDefence: 6, reduced: false, strength: 550 });
    expect(full.dugIn).toBeUndefined();
    expect([valuesLabel(full.attack, full.defence), menLabel(full), strengthShare(full)]).toEqual(["4-6", "550/550", 1]);
    expect(figuresDescription(full)).toBe("attack 4, defence 6, 550 of 550 men");

    const half = shaken({ ...state, fortification: { [territory("madrid")]: { factionId: faction("republic"), level: 2 } } }, "rep-covadonga-4", { strength: 370 });
    const figures = armyFigures(scenario, half, armyIn(half, "rep-covadonga-4"));
    expect(figures).toMatchObject({ attack: 1, defence: 2, dugIn: 2, reduced: true, strength: 370 });
    expect(figuresDescription(figures)).toBe("attack 1, defence 2 (full 4-6), 370 of 550 men, demoralized, cannot attack, dug in +2");
    expect(counterLabel(scenario, figures, armyIn(half, "rep-covadonga-4"), "rest"))
      .toBe("Covadonga Infantry Regiment No. 4, Republican Government, attack 1, defence 2 (full 4-6), 370 of 550 men, demoralized, cannot attack, dug in +2, resting");
    expect(counterLabel(scenario, full, armyIn(state, "rep-wad-ras-1"), undefined)).toBe("Wad-Ras Infantry Regiment No. 1, Republican Government, attack 4, defence 6, 550 of 550 men");
    expect(groupOrdersDescription(["entrench", "move", "rest", "move"])).toBe("2 moving, 1 entrenching, 1 resting");
    expect(groupOrdersDescription([])).toBe("");
  });

  it("shows works only to the faction that dug them", () => {
    const scenario = spain();
    const state = { ...initialGameState(scenario), fortification: { [territory("madrid")]: { factionId: faction("north"), level: 3 } } };
    expect(armyFigures(scenario, state, armyIn(state, "rep-wad-ras-1")).dugIn).toBeUndefined();
  });

  it("states the morale rule from the scenario's factor", () => {
    expect(demoralizedRule(spain())).toContain("fight at half their values and cannot attack");
    const other: Scenario = { ...spain(), combat: { ...spain().combat, demoralizationFactor: 0.75 } };
    expect(demoralizedRule(other)).toContain("75 percent of their values");
  });

  it("reads a fixture army below full strength", () => {
    const scenario = tiny();
    const state = initialGameState(scenario);
    const rangers = armyFigures(scenario, state, armyIn(state, "red-rangers"));
    expect([valuesLabel(rangers.attack, rangers.defence), valuesLabel(rangers.fullAttack, rangers.fullDefence), menLabel(rangers), strengthShare(rangers)])
      .toEqual(["3-4", "4-5", "300/400", 0.75]);
  });
});

describe("destination odds (C15)", () => {
  it("estimates reinforcement, unopposed, and battle destinations", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    const madrid = [unit("rep-wad-ras-1"), unit("rep-covadonga-4")];
    const estimates = destinationEstimates(scenario, state, faction("republic"), madrid, [territory("castilla-la-mancha"), territory("castilla-y-leon")]);
    expect(estimates.get(territory("castilla-la-mancha"))).toEqual({ kind: "reinforcement" });
    const battleEstimate = estimates.get(territory("castilla-y-leon"));
    expect(battleEstimate?.kind).toBe("battle");
    if (battleEstimate?.kind !== "battle") throw new Error("expected a battle");
    expect(oddsSummary(battleEstimate)).toEqual({
      chip: `\u2248 ${battleEstimate.oddsLabel} \u00b7 ${percent(battleEstimate.takeChance)}`,
      label: `Approx. ${battleEstimate.oddsLabel} \u00b7 ${percent(battleEstimate.takeChance)}`,
      sentence: `Approximately ${battleEstimate.oddsLabel}, ${String(Math.round(battleEstimate.takeChance * 100))} percent to take it.`,
      tone: chanceTone(battleEstimate.takeChance)
    });
    const empty = withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"]]);
    expect(destinationEstimates(scenario, empty, faction("republic"), [unit("rep-wad-ras-1")], [territory("castilla-y-leon")]).get(territory("castilla-y-leon")))
      .toEqual({ kind: "unopposed" });
    expect(destinationEstimates(scenario, state, faction("republic"), [], [territory("castilla-y-leon")]).size).toBe(0);
  });

  describe("combined attackers (A1)", () => {
    const one = [unitType("one", 1, 1)];
    const { scenario, state } = battlefield(tiny(), [
      { faction: "red", id: "r1", territory: "highlands", type: "one" },
      { faction: "red", id: "r2", territory: "isle", type: "one" },
      { faction: "blue", id: "b1", territory: "harbor", type: "one" },
      { faction: "blue", id: "b2", territory: "lowlands", type: "one" }
    ], { types: one });
    const harbor = territory("harbor");
    const oddsAt = (selected: readonly string[], planned: readonly MoveOrder[]) => {
      const estimate = destinationEstimates(scenario, state, faction("red"), selected.map(unit), [harbor], planned).get(harbor);
      if (estimate?.kind !== "battle") throw new Error("expected a battle");
      return [estimate.oddsLabel, estimate.attacker.armies.map((army) => army.unitId)];
    };

    it("reads one army at 1 against 1 as 1:1", () => {
      expect(oddsAt(["r1"], [])).toEqual(["1:1", [unit("r1")]]);
    });

    it("adds a planned move from another territory to the same destination", () => {
      expect(oddsAt(["r1"], [move("red", "r2", "isle", "harbor")])).toEqual(["2:1", [unit("r1"), unit("r2")]]);
      // A move elsewhere sends nobody here.
      expect(oddsAt(["r1"], [move("red", "r2", "isle", "lowlands")])[0]).toBe("1:1");
    });

    it("counts an army already in a planned order once when it is selected again", () => {
      expect(oddsAt(["r1"], [move("red", "r1", "highlands", "harbor"), move("red", "r2", "isle", "harbor")])).toEqual(["2:1", [unit("r1"), unit("r2")]]);
    });

    it("moves a re-selected army's weight to its new destination, as Move replaces its order", () => {
      const lowlands = territory("lowlands");
      const attackers = (estimate: DestinationEstimate | undefined) => (estimate?.kind === "battle" ? estimate.attacker.armies.map((army) => army.unitId) : []);
      // r1 and r2 are planned into the harbor, and r1 is selected again to go elsewhere.
      const planned = [move("red", "r1", "highlands", "harbor"), move("red", "r2", "isle", "harbor")];
      const choosing = destinationEstimates(scenario, state, faction("red"), [unit("r1")], [harbor, lowlands], planned);
      expect(attackers(choosing.get(harbor))).toEqual([unit("r1"), unit("r2")]);
      expect(attackers(choosing.get(lowlands))).toEqual([unit("r1")]);
      // Move replaces r1's order (planning), so the harbor's planned odds drop it.
      const replaced = plannedEstimates(scenario, state, faction("red"), [move("red", "r2", "isle", "harbor"), move("red", "r1", "highlands", "lowlands")]);
      expect(attackers(replaced.get(harbor))).toEqual([unit("r2")]);
      expect(attackers(replaced.get(lowlands))).toEqual([unit("r1")]);
    });

    it("combines the planned moves into each destination for the planned orders", () => {
      const planned = plannedEstimates(scenario, state, faction("red"), [
        move("red", "r1", "highlands", "harbor"),
        move("red", "r2", "isle", "harbor"),
        move("blue", "b1", "harbor", "lowlands")
      ]);
      expect([...planned.keys()]).toEqual([harbor]);
      const estimate = planned.get(harbor);
      expect(estimate?.kind === "battle" && oddsSummary(estimate)).toMatchObject({ chip: "\u2248 2:1 \u00b7 33%", label: "Approx. 2:1 \u00b7 33%", sentence: "Approximately 2:1, 33 percent to take it." });
      expect(plannedEstimates(scenario, state, faction("red"), []).size).toBe(0);
    });
  });

  it("words every kind of estimate and modifier", () => {
    expect(oddsSummary({ kind: "reinforcement" })).toMatchObject({ chip: "Reinforce", tone: "safe" });
    expect(oddsSummary({ kind: "unopposed" })).toMatchObject({ chip: "Unopposed", tone: "safe" });
    expect([chanceTone(5 / 6), chanceTone(0.5), chanceTone(1 / 6)]).toEqual(["good", "even", "poor"]);
    expect([percent(0.5), percent(1 / 6), signed(2), signed(-1), signed(0)]).toEqual(["50%", "17%", "+2", "\u22121", "0"]);
    expect(modifierName({ kind: "dug-in", level: 2, roll: -2 })).toBe("Dug in +2");
    expect(modifierName({ factionId: faction("republic"), kind: "faction", modifierId: "popular-resistance", name: "Popular resistance", role: "defence", roll: -1 }))
      .toBe("Popular resistance +1");
    expect(modifierPhrase({ kind: "odds-overflow", roll: 2 })).toBe("Odds beyond 6:1 +2");
    expect(modifierPhrase({ halvings: 1, kind: "odds-halving", roll: -1 })).toBe("Odds below 1:1 (1 halving) \u22121");
    expect(modifierName({ halvings: 2, kind: "odds-halving", roll: -2 })).toBe("Odds below 1:1 (2 halvings)");
    expect(modifierPhrase({ kind: "dug-in", level: 1, roll: -1 })).toBe("Dug in +1");
  });

  it("places plaques clear of counters and of each other", () => {
    const at = { x: 100, y: 100 };
    const free = placeOddsPlaques([{ at, territoryId: territory("a"), text: "2:1 \u00b7 50%" }], []);
    expect(free.get(territory("a"))?.y).toBeLessThan(at.y);
    const covered = placeOddsPlaques(
      [{ at, territoryId: territory("a"), text: "Reinforce" }, { at, territoryId: territory("b"), text: "Reinforce" }],
      [{ height: 40, width: 200, x: 0, y: 50 }]
    );
    expect(covered.get(territory("a"))?.y).toBeGreaterThan(at.y);
    expect(covered.get(territory("b"))).toBeDefined();
  });
});

describe("battle reports (C14)", () => {
  it("names the rule each battle was fought under", () => {
    expect([threeSidedAssault[0], roadMeeting, standingBattle, contestedEntry].map((entry) => (entry === undefined ? "" : battleKind(entry))))
      .toEqual(["assault", "meeting", "standing", "entry"]);
  });

  it("groups several attackers at one place and puts places that changed hands first", () => {
    const groups = groupBattles(spainShowcaseOutcomes());
    expect(groups.map((entry) => [entry.key, entry.battles.length])).toEqual([
      ["assault:castilla-la-mancha", 2],
      ["entry:extremadura", 1],
      ["assault:murcia", 1],
      ["assault:madrid", 1],
      ["meeting:navarra:pais-vasco", 1],
      ["assault:asturias", 1]
    ]);
    expect(groups.map((entry) => changedHands(entry))).toEqual([true, true, true, false, false, false]);
    expect(groups.map(groupTerritory)).toEqual(["castilla-la-mancha", "extremadura", "murcia", "madrid", undefined, "asturias"]);
    expect(battleSummary(groups)).toBe("6 battles \u00b7 3 territories changed hands \u00b7 2,835 men lost \u00b7 4 units destroyed \u00b7 5 units demoralized");
    expect(battleSummary(groupBattles([roadMeeting]))).toBe("1 battle \u00b7 1 unit demoralized");
  });

  it("leads a card with the battle that decided the place", () => {
    expect(decisiveBattle(group(threeSidedAssault)).battle.attackerFactionId).toBe("south");
    const held = threeSidedAssault.map((entry) => ({ ...entry, site: madridRepulsed.site }));
    expect(decisiveBattle(group(held)).battle).toMatchObject({ result: "defender-exchange" });
  });

  it("measures sides, losses, and who a result fell on", () => {
    const [north, south] = threeSidedAssault;
    if (north === undefined || south === undefined) throw new Error("fixture");
    expect(sideFactions(side(army("a", "north", "x", 2), army("b", "south", "x", 5), army("c", "north", "x", 4)))).toEqual(["north", "south"]);
    expect([sideLosses(south, south.attacker), sideLosses(south, south.defender)]).toEqual([450, 550]);
    expect([affectedFaction(north), affectedFaction(south), affectedFaction(standingBattle)]).toEqual(["north", "republic", "north"]);
    expect(lostArmies(surrenderAfterBattle)).toEqual(["rep-sevilla-34"]);
    expect([formatMen(1240), columnLabel(0), columnLabel(3), rawRow(north), north.row]).toEqual(["1,240", "below 1:1", "3:1", 2, 2]);
    expect(rawRow(battle({ ...madridRepulsed, attacker: madridRepulsed.attacker, attackerFactionId: "north", defender: madridRepulsed.defender, die: 1, modifiers: [{ kind: "dug-in", level: 3, roll: -3 }], site: madridRepulsed.site }))).toBe(-2);
  });

  it("says who holds the place", () => {
    const scenario = spain();
    expect(occupationLine(scenario, madridRepulsed)).toBe("Madrid held by the Republican Government.");
    expect(occupationLine(scenario, contestedEntry)).toBe("The Southern Insurgent Command took Extremadura.");
    expect(occupationLine(scenario, { ...madridRepulsed, site: { kind: "assault", occupation: { kind: "left-empty" }, territoryId: territory("madrid") } }))
      .toBe("Madrid was left empty.");
    expect(occupationLine(scenario, roadMeeting)).toBe("The Northern Insurgent Command won the road and continued its move.");
    expect(occupationLine(scenario, { ...roadMeeting, site: { between: [territory("navarra"), territory("pais-vasco")], kind: "meeting" } }))
      .toBe("Neither side won the road; both returned.");
  });

  it("fills a flavor line for every result, on a territory and on the road", () => {
    const scenario = spain();
    for (const result of battleResults) {
      for (const base of [madridRepulsed, roadMeeting]) {
        const line = sentenceCase(outcomeLine(result, flavorValues(scenario, { ...base, result }), flavorSeed(7, 1, 3)));
        expect(line).not.toMatch(/\{|\}/);
        expect(line.charAt(0)).toBe(line.charAt(0).toUpperCase());
      }
    }
    const name = (id: string) => territoryName(scenario, territory(id));
    expect(flavorValues(scenario, roadMeeting)).toMatchObject({ territory: `the road between ${name("navarra")} and ${name("pais-vasco")}` });
    expect(flavorValues(scenario, madridRepulsed)).toMatchObject({ city: "Madrid", losses: "1,050", origin: name("castilla-y-leon") });
    expect(flavorValues(scenario, { ...surrenderAfterBattle, retreats: [{ from: territory("murcia"), to: territory("valencia"), unitId: unit("rep-sevilla-34") }] }))
      .toMatchObject({ retreat: "Valencia" });
    expect(flavorSeed(7, 2, 5)).toBe(flavorSeed(7, 2, 5));
    expect(flavorSeed(7, 2, 5)).not.toBe(flavorSeed(7, 2, 6));
  });

  it("covers every outcome key with art and words", () => {
    expect(outcomeKeys).toHaveLength(12);
  });
});

describe("rule notes (section 1.6, C9, M27)", () => {
  const scenario = spain();
  const state = initialGameState(scenario);

  it("needs no note for a plain two-sided assault", () => {
    expect(ruleNote(scenario, state, group([madridRepulsed]))).toBeUndefined();
  });

  it("explains several attackers with the real numbers", () => {
    const note = ruleNote(scenario, state, group(threeSidedAssault));
    expect(note?.title).toBe("How a battle with several attackers is decided");
    expect(note?.steps[0]).toBe("The Northern Insurgent Command and the Southern Insurgent Command attacked Castilla-La Mancha at once. Each fought the defenders separately, all from the same starting values, so the order did not matter.");
    expect(note?.steps[2]).toBe("Only the Southern Insurgent Command succeeded, so it claimed Castilla-La Mancha alone.");

    const failed = threeSidedAssault.map((entry) => ({ ...entry, result: "attacker-demoralized" as const, site: madridRepulsed.site }));
    expect(ruleNote(scenario, state, group(failed))?.steps[2]).toBe("No attack succeeded, so the defenders held Madrid.");
  });

  it("names the claimants' remaining attack and the winner, or the tie", () => {
    const [north, south] = threeSidedAssault;
    if (north === undefined || south === undefined) throw new Error("fixture");
    const both = [{ ...north, result: "defender-demoralized" as const }, south];
    expect(claimants(group(both))).toHaveLength(2);
    expect(attackLeft(scenario, state, south)).toBe(8);
    const gone = { ...state, units: Object.fromEntries(Object.entries(state.units).filter(([id]) => id !== "south-granada-6")) };
    expect(attackLeft(scenario, gone, south)).toBe(4);
    expect(ruleNote(scenario, state, group(both))?.steps[2]).toBe(
      "Several attackers succeeded. The one with the greatest attack left after its own losses moves in: the Northern Insurgent Command 4 and the Southern Insurgent Command 8. The Southern Insurgent Command moved in; the others returned home without further loss."
    );
    const tied = both.map((entry) => ({ ...entry, site: { kind: "assault" as const, occupation: { kind: "left-empty" as const }, territoryId: territory("castilla-la-mancha") } }));
    expect(ruleNote(scenario, state, group(tied))?.steps[2]).toContain("That was a tie, so every claimant returned home and Castilla-La Mancha was left empty.");
  });

  it("explains entries, meetings, and standing battles", () => {
    expect(ruleNote(scenario, state, group([contestedEntry]))?.steps[1]).toBe(
      "The entrant with the greatest attack, the Southern Insurgent Command, stood as defender, using its attack of 4 as its defence, with no works. Every other entrant fought it."
    );
    const meeting = ruleNote(scenario, state, group([roadMeeting]));
    expect(meeting?.steps[1]).toBe("The side with the greater attack, the Northern Insurgent Command, attacked with 4 against a defence of 4. On the road neither side has works or faction modifiers.");
    expect(meeting?.steps[2]).toBe("The Northern Insurgent Command won and continued its move as if the road were clear. The other side returned to where it started.");
    const drawn = { ...roadMeeting, site: { between: [territory("navarra"), territory("pais-vasco")] as const, kind: "meeting" as const } };
    expect(ruleNote(scenario, state, group([drawn]))?.steps[2]).toBe("Neither side won, so both returned to where they started.");
    expect(ruleNote(scenario, state, group([standingBattle]))?.steps[0]).toBe(
      "Armies of the Northern Insurgent Command and the Republican Government were all still in Asturias after the other battles."
    );
  });
});

describe("battle routes and legend", () => {
  it("draws a battle where an army moved into one, and nothing for a standing battle", () => {
    expect(battleRoutes(madridRepulsed).map((entry) => [entry.from, entry.to, entry.kind])).toEqual([
      ["castilla-y-leon", "madrid", "battle"],
      ["castilla-y-leon", "madrid", "battle"]
    ]);
    expect(battleRoutes(roadMeeting).map((entry) => [entry.unitId, entry.from, entry.to])).toEqual([
      ["north-america-23", "navarra", "pais-vasco"],
      ["rep-basque-column", "pais-vasco", "navarra"]
    ]);
    expect(battleRoutes(contestedEntry)).toHaveLength(2);
    expect(battleRoutes(standingBattle)).toEqual([]);
  });

  it("replaces a fought move's bounce with the battle and draws arriving reinforcements", () => {
    const bounced = { cause: { holdingFactionIds: [faction("republic")], kind: "held" as const }, kind: "bounced-move" as const, order: move("north", "north-san-marcial-22", "castilla-y-leon", "madrid") };
    const routes = groupRoutes([], [bounced, madridRepulsed, { kind: "reinforcement-arrived", order: move("republic", "rep-otumba-9", "valencia", "castilla-la-mancha") }]);
    expect(routes.map((route) => [route.kind, route.from, route.to, route.count, route.battle?.result])).toEqual([
      ["moved", "valencia", "castilla-la-mancha", 1, undefined],
      ["battle", "castilla-y-leon", "madrid", 2, "attacker-attrition"]
    ]);
    expect(routes[1]?.battle?.affectedFactionId).toBe("north");
  });

  it("lists battle results, statuses, and odds when the map shows them", () => {
    const scenario = spain();
    const state = shaken({ ...initialGameState(scenario), fortification: { [territory("madrid")]: { factionId: faction("republic"), level: 1 } } }, "rep-otumba-9");
    const entries = legendEntries(scenario, state, { ...staticMapView, outcomes: spainShowcaseOutcomes() });
    expect(entries).toEqual(expect.arrayContaining(["moved", "bounced", "attacker-eliminated", "defender-exchange", "demoralized", "dug-in"]));
    expect(legendEntries(scenario, state, { ...staticMapView, destinationEstimates: new Map(), destinationIds: [territory("madrid")] })).toContain("destination-odds");
  });
});

describe("outcome art levels", () => {
  it("clamps works levels to the pips the art can show", () => {
    expect([0, 1, 2, 3, 5].map(artLevel)).toEqual([1, 1, 2, 3, 3]);
  });
});

describe("dispatch lines that agree with the headline", () => {
  const scenario = spain();
  const leftEmpty = { ...madridRepulsed, site: { kind: "assault" as const, occupation: { kind: "left-empty" as const }, territoryId: territory("madrid") } };

  it("never says a place left empty was taken or held", () => {
    for (const result of battleResults) {
      for (const seed of [0, 1, 2, 3, 4, 5]) {
        const line = cardFlavor(scenario, { ...leftEmpty, result }, seed);
        expect(line).not.toMatch(/\b(took|taken|occupied|now hold|held every road|changed hands|overrun|fallen)\b/i);
        expect(line).not.toMatch(/[{}]/);
      }
    }
    expect(cardFlavor(scenario, { ...leftEmpty, result: "defender-exchange" }, 3)).toBe(
      "Madrid was left empty. The attackers who broke in were too evenly matched for any of them to hold it."
    );
  });

  it("uses the ordinary line everywhere else", () => {
    expect(cardFlavor(scenario, madridRepulsed, 4)).toBe(outcomeLine(madridRepulsed.result, flavorValues(scenario, madridRepulsed), 4));
  });
});
