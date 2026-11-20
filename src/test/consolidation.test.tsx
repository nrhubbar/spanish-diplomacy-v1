import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { generateComputerSubmission, legalMoves } from "../main/ai/computerPlayer";
import type { BattleDice } from "../main/engine/dice";
import { deriveSeed, seededRandom } from "../main/engine/random";
import { initialGameState } from "../main/engine/resolution";
import { type GameState, isMoveOrder, type MoveOrder, type Scenario, type TurnOutcome, type TurnResolutionResult } from "../main/engine/types";
import { legalDestinations } from "../main/engine/validation";
import { groupRoutes } from "../main/map/routes";
import { describeOutcome, describeOutcomeGroup, groupOutcomes } from "../main/presentation/text";
import { OutcomeSummary } from "../main/screens/ResultPanels";
import { chooseOrderKind, clickMapTerritory, openSetup, startGame, toggleOrderMenu } from "../main/state/gameSlice";
import { emptyDraft } from "../main/state/session";
import { type ArmySpec, battlefield, battlesOf, faction, loadedDice, move, play as resolve, spainM2, spainId, territory, testStore, tiny, unit, withUnits } from "./support";

// Friendly consolidation: armies of one faction never block, bounce, fight, or disband each
// other. Only other factions stop a move or fight it (M11, M17-M21).
//
// Changed in Revision 6: a move into a territory the faction controls, or where its armies
// stay, is a reinforcement (M11) and always arrives, so several Revision 5 bounces are now
// reinforcements, and a move into a hostile-held territory is a battle rather than a bounce.

function play(scenario: Scenario, state: GameState, orders: readonly MoveOrder[], dice?: BattleDice): TurnResolutionResult {
  return resolve(scenario, state, orders, dice);
}

/** Outcome kind (and bounce cause) per ordered unit, in a compact readable form. */
function resultOf(result: TurnResolutionResult, unitId: string): string {
  const outcome = result.outcomes.find((candidate): candidate is Extract<TurnOutcome, { order: MoveOrder }> =>
    "order" in candidate && "from" in candidate.order && candidate.order.kind === "move" && candidate.order.unitId === unitId);
  if (outcome === undefined) {
    const ordered = result.submittedOrders.some((order) => "unitId" in order && order.unitId === unitId);
    const fought = battlesOf(result).some((battle) => battle.attacker.armies.some((army) => army.unitId === unitId));
    return ordered && fought ? "fought" : "no order";
  }
  switch (outcome.kind) {
    case "successful-move":
      return "moved";
    case "bounced-move":
      return `bounced:${outcome.cause.kind}`;
    case "disbanded-move":
      return `lost:${outcome.cause.kind}`;
    case "invalid-order":
      return "invalid";
    case "reinforcement-arrived":
      return "reinforced";
  }
}

const at = (result: TurnResolutionResult, unitId: string) => result.finalState.units[unit(unitId)]?.territoryId;
const red = (id: string, where: string): ArmySpec => ({ faction: "red", id, territory: where });
const blue = (id: string, where: string): ArmySpec => ({ faction: "blue", id, territory: where });

describe("friendly consolidation (engine)", () => {
  it("lets friendly units from different territories enter the same empty territory (M6)", () => {
    const scenario = tiny();
    const result = play(scenario, withUnits(scenario, [["a", "red", "westfold"], ["b", "red", "harbor"]]), [
      move("red", "a", "westfold", "lowlands"),
      move("red", "b", "harbor", "lowlands")
    ]);
    expect([resultOf(result, "a"), resultOf(result, "b")]).toEqual(["moved", "moved"]);
    expect([at(result, "a"), at(result, "b")]).toEqual(["lowlands", "lowlands"]);
    expect(result.finalState.control[territory("lowlands")]).toEqual({ factionId: "red", kind: "controlled" });
  });

  it("lets friendly units join friendly units holding the destination as reinforcements (M11)", () => {
    const scenario = tiny();
    const result = play(scenario, withUnits(scenario, [["a", "red", "westfold"], ["b", "red", "harbor"], ["c", "red", "lowlands"]]), [
      move("red", "a", "westfold", "lowlands"),
      move("red", "b", "harbor", "lowlands")
    ]);
    expect([resultOf(result, "a"), resultOf(result, "b")]).toEqual(["reinforced", "reinforced"]);
    expect([at(result, "a"), at(result, "b"), at(result, "c")]).toEqual(["lowlands", "lowlands", "lowlands"]);
  });

  it("lets a unit enter a territory a friendly unit is leaving, whether that unit leaves or returns from a battle", () => {
    const scenario = tiny();
    const leaves = play(scenario, withUnits(scenario, [["a", "red", "westfold"], ["r", "red", "highlands"]]), [
      move("red", "a", "westfold", "highlands"),
      move("red", "r", "highlands", "harbor")
    ]);
    expect([resultOf(leaves, "a"), resultOf(leaves, "r")]).toEqual(["reinforced", "moved"]);
    expect([at(leaves, "a"), at(leaves, "r")]).toEqual(["highlands", "harbor"]);

    // r attacks Blue in the Harbor and is driven back; a still arrives, and r comes home to
    // its friend rather than falling back (M21).
    const field = battlefield(scenario, [red("a", "westfold"), red("r", "highlands"), blue("b", "harbor")]);
    const returns = play(field.scenario, field.state, [move("red", "a", "westfold", "highlands"), move("red", "r", "highlands", "harbor")], loadedDice([5]));
    expect([resultOf(returns, "a"), resultOf(returns, "r")]).toEqual(["reinforced", "fought"]);
    expect(battlesOf(returns)[0]).toMatchObject({ result: "attacker-demoralized", retreats: [] });
    expect([at(returns, "a"), at(returns, "r")]).toEqual(["highlands", "highlands"]);
  });

  it("lets friendly units swap territories without meeting head-on (M20 applies only to other factions)", () => {
    const scenario = tiny();
    const result = play(scenario, withUnits(scenario, [["a", "red", "westfold"], ["r", "red", "highlands"]]), [
      move("red", "a", "westfold", "highlands"),
      move("red", "r", "highlands", "westfold")
    ]);
    expect([resultOf(result, "a"), resultOf(result, "r")]).toEqual(["reinforced", "reinforced"]);
    expect([at(result, "a"), at(result, "r")]).toEqual(["highlands", "westfold"]);
  });

  it("resolves friendly chains and rotations in full", () => {
    const scenario = tiny();
    const ring = [["w", "red", "westfold"], ["h", "red", "highlands"], ["p", "red", "harbor"], ["l", "red", "lowlands"]] as const;
    const rotation = play(scenario, withUnits(scenario, ring), [
      move("red", "w", "westfold", "highlands"),
      move("red", "h", "highlands", "harbor"),
      move("red", "p", "harbor", "lowlands"),
      move("red", "l", "lowlands", "westfold")
    ]);
    expect(["w", "h", "p", "l"].map((id) => at(rotation, id))).toEqual(["highlands", "harbor", "lowlands", "westfold"]);

    // The head of the chain attacks Blue and is driven back; the rest still advance and nobody is lost.
    const field = battlefield(scenario, [red("l", "lowlands"), red("w", "westfold"), red("h", "highlands"), blue("b", "harbor")]);
    const chain = play(field.scenario, field.state, [
      move("red", "l", "lowlands", "westfold"),
      move("red", "w", "westfold", "highlands"),
      move("red", "h", "highlands", "harbor")
    ], loadedDice([5]));
    expect(["l", "w", "h"].map((id) => resultOf(chain, id))).toEqual(["reinforced", "reinforced", "fought"]);
    expect(["l", "w", "h"].map((id) => at(chain, id))).toEqual(["westfold", "highlands", "highlands"]);
  });

  it("lets several friendly units reinforce a territory shared with a stationary hostile (OD-7)", () => {
    const scenario = spainM2();
    const units = [
      ["rep-vitoria-8", "republic", "andalucia"],
      ["south-granada-6", "south", "andalucia"],
      ["rep-sevilla-34", "republic", "murcia"],
      ["rep-wad-ras-1", "republic", "castilla-la-mancha"]
    ] as const;
    const orders = [
      move("republic", "rep-sevilla-34", "murcia", "andalucia"),
      move("republic", "rep-wad-ras-1", "castilla-la-mancha", "andalucia")
    ];
    // They arrive, and the shared territory then fights its standing battle (M27): 12 against 6,
    // and a 3 demoralizes both sides, so both stay.
    const result = play(scenario, withUnits(scenario, units), orders, loadedDice([3]));
    expect([resultOf(result, "rep-sevilla-34"), resultOf(result, "rep-wad-ras-1")]).toEqual(["reinforced", "reinforced"]);
    expect(battlesOf(result).map((battle) => [battle.site.kind, battle.attackerFactionId, battle.result])).toEqual([["standing", "republic", "both-demoralized"]]);
    expect(result.finalState.control[territory("andalucia")]?.kind).toBe("contested");

    // Without a friendly foothold the two attack the stationary hostile together (M17).
    const noFoothold = play(scenario, withUnits(scenario, units.slice(1)), orders, loadedDice([2]));
    expect([resultOf(noFoothold, "rep-sevilla-34"), resultOf(noFoothold, "rep-wad-ras-1")]).toEqual(["fought", "fought"]);
    expect(battlesOf(noFoothold)[0]).toMatchObject({ attacker: { value: 8 }, result: "attacker-demoralized", site: { kind: "assault", territoryId: "andalucia" } });
    expect([at(noFoothold, "rep-sevilla-34"), at(noFoothold, "rep-wad-ras-1")]).toEqual(["murcia", "castilla-la-mancha"]);
  });

  it("keys the reinforcement exception on friendly units that stay, as M11 states", () => {
    // When the only friendly occupant is ordered out, the entering unit faces the hostile alone
    // and attacks it, even if the occupant itself comes back.
    const scenario = spainM2();
    const units = [
      ["rep-vitoria-8", "republic", "andalucia"],
      ["south-granada-6", "south", "andalucia"],
      ["rep-sevilla-34", "republic", "murcia"],
      ["south-legion", "south", "ceuta"]
    ] as const;
    const leaves = play(scenario, withUnits(scenario, units), [
      move("republic", "rep-vitoria-8", "andalucia", "extremadura"),
      move("republic", "rep-sevilla-34", "murcia", "andalucia")
    ], loadedDice([4]));
    expect([resultOf(leaves, "rep-vitoria-8"), resultOf(leaves, "rep-sevilla-34")]).toEqual(["moved", "fought"]);
    expect(battlesOf(leaves)[0]).toMatchObject({ defender: { armies: [{ unitId: "south-granada-6" }] }, site: { territoryId: "andalucia" } });

    const staysBehind = play(scenario, withUnits(scenario, units), [
      move("republic", "rep-vitoria-8", "andalucia", "ceuta"),
      move("republic", "rep-sevilla-34", "murcia", "andalucia")
    ], loadedDice([4, 4, 4]));
    expect([resultOf(staysBehind, "rep-vitoria-8"), resultOf(staysBehind, "rep-sevilla-34")]).toEqual(["fought", "fought"]);
    expect([at(staysBehind, "rep-vitoria-8"), at(staysBehind, "rep-sevilla-34")]).toEqual(["andalucia", "murcia"]);
  });

  it("brings friendly units moving together into their own territory, even when other factions attack it (C10)", () => {
    const scenario = spainM2();
    const result = play(scenario, initialGameState(scenario), [
      move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha"),
      move("republic", "rep-covadonga-4", "madrid", "castilla-la-mancha"),
      move("north", "north-aragon-17", "aragon", "castilla-la-mancha"),
      move("south", "south-granada-6", "andalucia", "castilla-la-mancha"),
      move("south", "south-lepanto-5", "andalucia", "castilla-la-mancha")
    ], loadedDice([1, 1, 4, 4]));
    expect([resultOf(result, "rep-wad-ras-1"), resultOf(result, "rep-covadonga-4")]).toEqual(["reinforced", "reinforced"]);
    const attacks = battlesOf(result).filter((battle) => battle.site.kind === "assault");
    expect(attacks.map((battle) => battle.attackerFactionId)).toEqual(["north", "south"]);
    for (const battle of attacks) {
      expect(battle.defender.armies.map((army) => [army.unitId, army.from])).toEqual([["rep-wad-ras-1", "madrid"], ["rep-covadonga-4", "madrid"]]);
    }
  });

  it("brings a friendly mover into a friendly-held territory even when a hostile also moves in", () => {
    // Blue controls the Lowlands, so its move is a reinforcement too. Both arrive, and the two
    // factions sharing the Lowlands fight a standing battle (M27).
    const field = battlefield(tiny(), [red("c", "lowlands"), red("a", "westfold"), blue("b", "harbor")]);
    const result = play(field.scenario, field.state, [move("red", "a", "westfold", "lowlands"), move("blue", "b", "harbor", "lowlands")], loadedDice([3]));
    expect([resultOf(result, "a"), resultOf(result, "b"), resultOf(result, "c")]).toEqual(["reinforced", "reinforced", "no order"]);
    expect(battlesOf(result).map((battle) => [battle.site.kind, battle.attackerFactionId, battle.result])).toEqual([["standing", "red", "both-demoralized"]]);
    expect([at(result, "a"), at(result, "b"), at(result, "c")]).toEqual(["lowlands", "lowlands", "lowlands"]);
  });

  it("keeps a friendly swap intact for the unit no hostile contests", () => {
    const field = battlefield(tiny(), [red("a", "westfold"), red("r", "highlands"), blue("b", "harbor")]);
    const result = play(field.scenario, field.state, [
      move("red", "a", "westfold", "highlands"),
      move("red", "r", "highlands", "westfold"),
      move("blue", "b", "harbor", "highlands")
    ], loadedDice([1]));
    expect(["a", "r", "b"].map((id) => resultOf(result, id))).toEqual(["reinforced", "reinforced", "fought"]);
    // a arrives in time to defend the Highlands; r reaches Westfold.
    expect(battlesOf(result)[0]).toMatchObject({ defender: { armies: [{ from: "westfold", unitId: "a" }] }, result: "attacker-eliminated" });
    expect([at(result, "a"), at(result, "r")]).toEqual(["highlands", "westfold"]);
  });

  it("lets reinforcements pass a hostile on the road, so friend and foe swap places (M11)", () => {
    const scenario = tiny();
    const result = play(scenario, withUnits(scenario, [["a", "red", "westfold"], ["c", "red", "harbor"], ["b", "blue", "highlands"]]), [
      move("red", "a", "westfold", "highlands"),
      move("red", "c", "harbor", "highlands"),
      move("blue", "b", "highlands", "westfold")
    ]);
    expect(["a", "c", "b"].map((id) => resultOf(result, id))).toEqual(["reinforced", "reinforced", "moved"]);
    expect([at(result, "a"), at(result, "c"), at(result, "b")]).toEqual(["highlands", "highlands", "westfold"]);
    expect(result.finalState.control[territory("westfold")]).toEqual({ factionId: "blue", kind: "controlled" });
  });
});

describe("friendly consolidation (planning and computer players)", () => {
  it("offers friendly-held territories as destinations for several selected units", () => {
    const scenario = spainM2();
    const state = withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"], ["rep-covadonga-4", "republic", "madrid"], ["rep-otumba-9", "republic", "castilla-la-mancha"]]);
    expect(legalDestinations(scenario, state, faction("republic"), [unit("rep-wad-ras-1"), unit("rep-covadonga-4")]))
      .toEqual(["castilla-y-leon", "castilla-la-mancha"]);
  });

  it("plans moves into a territory friendly units hold or are already ordered into", () => {
    const store = testStore();
    store.dispatch(openSetup());
    store.dispatch(startGame(11));
    // Murcia -> Valencia, where two friendly regiments hold.
    // Selecting a territory selects all of its unordered armies, so each step is: select,
    // open the order menu, choose Move, pick the destination.
    const moveAll = (from: string, to: string) => {
      store.dispatch(clickMapTerritory(territory(from)));
      store.dispatch(toggleOrderMenu());
      store.dispatch(chooseOrderKind("move"));
      store.dispatch(clickMapTerritory(territory(to)));
    };
    moveAll("murcia", "valencia");
    // Valencia x2 and Madrid x4 -> Castilla-La Mancha, all six into one territory.
    moveAll("valencia", "castilla-la-mancha");
    moveAll("madrid", "castilla-la-mancha");
    const session = store.getState().game.session;
    expect(session.phase === "planning" && session.draft.feedback).toBeUndefined();
    expect(session.phase === "planning" && session.draft.orders.map((order) => `${order.unitId}->${order.to}`)).toEqual([
      "rep-sevilla-34->valencia",
      "rep-otumba-9->castilla-la-mancha",
      "rep-guadalajara-10->castilla-la-mancha",
      "rep-wad-ras-1->castilla-la-mancha",
      "rep-covadonga-4->castilla-la-mancha",
      "rep-madrid-security->castilla-la-mancha",
      "rep-madrid-sierra-column->castilla-la-mancha"
    ]);
  });

  it("never offers a demoralized army a hostile destination, so its attack cannot be planned (M23)", () => {
    const scenario = spainM2();
    const start = initialGameState(scenario);
    const units = Object.fromEntries(Object.values(start.units).map((army) =>
      [army.id, army.territoryId === "madrid" ? { ...army, morale: { demoralized: true, quietTurns: 0 } } : army]));
    const game = { assignments: { [faction("republic")]: "local-human" as const }, history: [], locked: {}, scenarioId: spainId, seed: 1, state: { ...start, units } };
    const store = testStore({ game: { session: { draft: emptyDraft, factionId: faction("republic"), game, phase: "planning" } } });
    store.dispatch(clickMapTerritory(territory("madrid")));
    store.dispatch(toggleOrderMenu());
    store.dispatch(chooseOrderKind("move"));
    // Castilla y Leon is held by the Northern command; Castilla-La Mancha is the Republic's own.
    store.dispatch(clickMapTerritory(territory("castilla-y-leon")));
    const session = store.getState().game.session;
    expect(session.phase === "planning" && session.draft.orders).toEqual([]);
    expect(session.phase === "planning" && session.draft.feedback).toBe("A demoralized army cannot attack. It can move only into empty or friendly territory.");
    // A territory that is not connected keeps its own explanation.
    store.dispatch(clickMapTerritory(territory("galicia")));
    const far = store.getState().game.session;
    expect(far.phase === "planning" && far.draft.feedback).toMatch(/not connected to Madrid/);
    store.dispatch(clickMapTerritory(territory("castilla-la-mancha")));
    const planned = store.getState().game.session;
    expect(planned.phase === "planning" && planned.draft.orders.map((order) => order.to)).toEqual(["castilla-la-mancha", "castilla-la-mancha", "castilla-la-mancha", "castilla-la-mancha"]);
  });

  it("lets computer players stack units: crowding is a preference, not a rule", () => {
    const scenario = spainM2();
    const state = withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"], ["rep-otumba-9", "republic", "castilla-la-mancha"]]);
    expect(legalMoves(scenario, state, state.units[unit("rep-wad-ras-1")]!).map((order) => order.to)).toContain("castilla-la-mancha");

    const initial = initialGameState(scenario);
    const stacked = Array.from({ length: 20 }, (_, seed) =>
      generateComputerSubmission(scenario, initial, faction("south"), seededRandom(deriveSeed(seed, 1, 2))))
      .some((submission) => new Set(submission.orders.filter(isMoveOrder).map((order) => order.to)).size < submission.orders.length);
    expect(stacked).toBe(true);
  });
});

/**
 * The reported case, as an equal-strength standoff (M19): two armies of each faction march on
 * empty Extremadura from Castilla-La Mancha, Castilla y Leon, and Andalucia, and all bounce.
 * With `capture`, Aragon's regiment takes Castilla-La Mancha behind the Republicans, whose
 * other neighbours are held by other factions, so they have nowhere to fall back (M21).
 */
function reportedCase(capture: boolean): TurnResolutionResult {
  const scenario = spainM2();
  const units = [
    ["rep-wad-ras-1", "republic", "castilla-la-mancha"],
    ["rep-covadonga-4", "republic", "castilla-la-mancha"],
    ["north-san-marcial-22", "north", "castilla-y-leon"],
    ["north-san-quintin-25", "north", "castilla-y-leon"],
    ["south-granada-6", "south", "andalucia"],
    ["south-lepanto-5", "south", "andalucia"],
    ["north-aragon-17", "north", "aragon"],
    ["north-zamora-29", "north", "madrid"],
    ["north-america-23", "north", "valencia"],
    ["south-cadiz-33", "south", "murcia"]
  ] as const;
  return play(scenario, withUnits(scenario, units), [
    move("republic", "rep-wad-ras-1", "castilla-la-mancha", "extremadura"),
    move("republic", "rep-covadonga-4", "castilla-la-mancha", "extremadura"),
    move("north", "north-san-marcial-22", "castilla-y-leon", "extremadura"),
    move("north", "north-san-quintin-25", "castilla-y-leon", "extremadura"),
    ...(capture ? [move("north", "north-aragon-17", "aragon", "castilla-la-mancha")] : []),
    move("south", "south-granada-6", "andalucia", "extremadura"),
    move("south", "south-lepanto-5", "andalucia", "extremadura")
  ]);
}

const lines = (result: TurnResolutionResult) =>
  groupOutcomes(result.outcomes).map((group) => describeOutcomeGroup(spainM2(), group, result.outcomes));

describe("friendly consolidation (turn report)", () => {
  afterEach(cleanup);

  it("reports formations that moved together as one line that names the faction and every opposing origin", () => {
    expect(lines(reportedCase(false)).slice(0, 3)).toEqual([
      "Republican Government: Wad-Ras Infantry Regiment No. 1 and Covadonga Infantry Regiment No. 4 tried to move together from Castilla-La Mancha to Extremadura and bounced: standoff with Northern Insurgent Command (from Castilla y Le\u00f3n) and Southern Insurgent Command (from Andaluc\u00eda).",
      "Northern Insurgent Command: San Marcial Infantry Regiment No. 22 and San Quint\u00edn Infantry Regiment No. 25 tried to move together from Castilla y Le\u00f3n to Extremadura and bounced: standoff with Republican Government (from Castilla-La Mancha) and Southern Insurgent Command (from Andaluc\u00eda).",
      "Southern Insurgent Command: Granada Infantry Regiment No. 6 and Lepanto Infantry Regiment No. 5 tried to move together from Andaluc\u00eda to Extremadura and bounced: standoff with Republican Government (from Castilla-La Mancha) and Northern Insurgent Command (from Castilla y Le\u00f3n)."
    ]);
  });

  it("reports a group lost to a capture of its origin, and the capture itself", () => {
    expect(lines(reportedCase(true)).slice(0, 2)).toEqual([
      "Republican Government: Wad-Ras Infantry Regiment No. 1 and Covadonga Infantry Regiment No. 4 were lost. They tried to move together from Castilla-La Mancha to Extremadura and bounced: standoff with Northern Insurgent Command (from Castilla y Le\u00f3n) and Southern Insurgent Command (from Andaluc\u00eda). Northern Insurgent Command took Castilla-La Mancha.",
      "Northern Insurgent Command: San Marcial Infantry Regiment No. 22 and San Quint\u00edn Infantry Regiment No. 25 tried to move together from Castilla y Le\u00f3n to Extremadura and bounced: standoff with Republican Government (from Castilla-La Mancha) and Southern Insurgent Command (from Andaluc\u00eda)."
    ]);
    expect(lines(reportedCase(true))).toContain("Northern Insurgent Command: Arag\u00f3n Infantry Regiment No. 17 moved from Arag\u00f3n to Castilla-La Mancha.");
  });

  it("groups only same-faction, same-route, same-result outcomes and lists several origins of one faction", () => {
    // Granada and the Legion, at reduced strength, attack at 2 each: 4, the same as Wad-Ras alone.
    const field = battlefield(spainM2(), [
      { faction: "republic", id: "rep-wad-ras-1", territory: "castilla-la-mancha" },
      { faction: "republic", id: "rep-covadonga-4", territory: "madrid" },
      { faction: "south", id: "south-granada-6", strength: 300, territory: "andalucia" },
      { faction: "south", id: "south-legion", strength: 600, territory: "castilla-y-leon" }
    ]);
    const result = play(field.scenario, field.state, [
      move("republic", "rep-wad-ras-1", "castilla-la-mancha", "extremadura"),
      move("republic", "rep-covadonga-4", "madrid", "castilla-la-mancha"),
      move("south", "south-granada-6", "andalucia", "extremadura"),
      move("south", "south-legion", "castilla-y-leon", "extremadura")
    ]);
    expect(groupOutcomes(result.outcomes).map((group) => group.unitIds)).toEqual([
      // The last four are the north's hold and each faction's income ($2).
      ["rep-wad-ras-1"], ["rep-covadonga-4"], ["south-granada-6"], ["south-legion"], [], [], [], []
    ]);
    const report = groupOutcomes(result.outcomes).map((group) => describeOutcomeGroup(field.scenario, group, result.outcomes));
    expect(report[0]).toBe("Republican Government: Wad-Ras Infantry Regiment No. 1 tried to move from Castilla-La Mancha to Extremadura and bounced: standoff with Southern Insurgent Command (from Andaluc\u00eda and Castilla y Le\u00f3n).");
    expect(report[1]).toBe("Republican Government: Covadonga Infantry Regiment No. 4 moved from Madrid to Castilla-La Mancha as reinforcements.");
    // Without the turn's outcomes the standoff still names the faction.
    expect(describeOutcome(field.scenario, result.outcomes[0]!)).toContain("bounced: standoff with Southern Insurgent Command.");
  });

  it("keeps holds and impossible orders on their own lines", () => {
    const scenario = tiny();
    const outcomes: readonly TurnOutcome[] = [
      { factionId: faction("red"), kind: "no-move", unitId: unit("red-guard") },
      { factionId: faction("red"), kind: "no-move", unitId: unit("red-rangers") },
      { factionId: faction("blue"), kind: "no-move" },
      { kind: "invalid-order", order: move("red", "red-guard", "westfold", "harbor"), reason: "Destination is not connected to the unit's territory." }
    ];
    expect(groupOutcomes(outcomes).map((group) => describeOutcomeGroup(scenario, group))).toEqual([
      "Red Guard held.",
      "Red Rangers held.",
      "Blue Union had no armies to order.",
      "Red League: Red Guard was disbanded after an impossible order: Destination is not connected to the unit's territory."
    ]);
  });

  it("shows one line per group in the summary and says that own armies never block each other", () => {
    render(<OutcomeSummary result={reportedCase(false)} scenario={spainM2()} />);
    const bounced = screen.getByText("Bounced (6)").closest("details");
    expect(within(bounced!).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText(/A faction's own armies never block each other/)).toBeVisible();
    cleanup();

    const scenario = spainM2();
    const state = withUnits(scenario, [["rep-wad-ras-1", "republic", "castilla-la-mancha"], ["rep-covadonga-4", "republic", "castilla-la-mancha"]]);
    render(<OutcomeSummary result={play(scenario, state, [move("republic", "rep-wad-ras-1", "castilla-la-mancha", "extremadura"), move("republic", "rep-covadonga-4", "castilla-la-mancha", "extremadura")])} scenario={scenario} />);
    expect(screen.getByText("Completed moves (2)")).toBeDefined();
    expect(screen.queryByText(/never block each other/)).toBeNull();
  });

  it("never counts another faction's formations in a route badge", () => {
    const routes = groupRoutes([], reportedCase(true).outcomes);
    expect(routes.filter((route) => route.to === "extremadura").map((route) => [route.kind, route.factionId, route.from, route.count])).toEqual([
      ["disbanded", "republic", "castilla-la-mancha", 2],
      ["bounced", "north", "castilla-y-leon", 2],
      ["bounced", "south", "andalucia", 2]
    ]);
  });
});
