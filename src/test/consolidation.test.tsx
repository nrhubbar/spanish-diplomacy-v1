import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { generateComputerSubmission, legalMoves } from "../main/ai/computerPlayer";
import { deriveSeed, seededRandom } from "../main/engine/random";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type { GameState, MoveOrder, PlayerSubmission, Scenario, TurnOutcome, TurnResolutionResult } from "../main/engine/types";
import { legalDestinations } from "../main/engine/validation";
import { groupRoutes } from "../main/map/routes";
import { describeOutcome, describeOutcomeGroup, groupOutcomes } from "../main/presentation/text";
import { OutcomeSummary } from "../main/screens/ResultPanels";
import { chooseOrderKind, clickMapTerritory, openSetup, startGame, toggleOrderMenu } from "../main/state/gameSlice";
import { faction, move, spain, territory, testStore, tiny, unit, withUnits } from "./support";

// Friendly consolidation: units of one faction never block, bounce, or disband each other
// (M3, M4 with the OD-7 reinforcement exception, M5, M8). Only other factions stop a move.

/** One submission per faction, in first-seen order, so tests can list orders flat. */
function submissions(orders: readonly MoveOrder[]): readonly PlayerSubmission[] {
  const byFaction = new Map<string, MoveOrder[]>();
  for (const order of orders) byFaction.set(order.factionId, [...(byFaction.get(order.factionId) ?? []), order]);
  return [...byFaction].map(([factionId, factionOrders]) => ({ factionId: faction(factionId), orders: factionOrders }));
}

function play(scenario: Scenario, state: GameState, orders: readonly MoveOrder[]): TurnResolutionResult {
  return resolveTurn(scenario, state, submissions(orders));
}

/** Outcome kind (and bounce cause) per ordered unit, in a compact readable form. */
function resultOf(result: TurnResolutionResult, unitId: string): string {
  const outcome = result.outcomes.find((candidate): candidate is Extract<TurnOutcome, { order: MoveOrder }> =>
    "order" in candidate && candidate.order.unitId === unitId);
  if (outcome === undefined) return "no order";
  switch (outcome.kind) {
    case "successful-move":
      return "moved";
    case "bounced-move":
      return `bounced:${outcome.cause.kind}`;
    case "disbanded-move":
      return `lost:${outcome.cause.kind}`;
    case "invalid-order":
      return "invalid";
  }
}

const at = (result: TurnResolutionResult, unitId: string) => result.finalState.units[unit(unitId)]?.territoryId;

describe("friendly consolidation (engine)", () => {
  it("lets friendly units from different territories enter the same empty territory (M3)", () => {
    const scenario = tiny();
    const result = play(scenario, withUnits(scenario, [["a", "red", "westfold"], ["b", "red", "harbor"]]), [
      move("red", "a", "westfold", "lowlands"),
      move("red", "b", "harbor", "lowlands")
    ]);
    expect([resultOf(result, "a"), resultOf(result, "b")]).toEqual(["moved", "moved"]);
    expect([at(result, "a"), at(result, "b")]).toEqual(["lowlands", "lowlands"]);
    expect(result.finalState.control[territory("lowlands")]).toEqual({ factionId: "red", kind: "controlled" });
  });

  it("lets friendly units join friendly units holding the destination (M4 applies only to hostiles)", () => {
    const scenario = tiny();
    const result = play(scenario, withUnits(scenario, [["a", "red", "westfold"], ["b", "red", "harbor"], ["c", "red", "lowlands"]]), [
      move("red", "a", "westfold", "lowlands"),
      move("red", "b", "harbor", "lowlands")
    ]);
    expect([resultOf(result, "a"), resultOf(result, "b")]).toEqual(["moved", "moved"]);
    expect([at(result, "a"), at(result, "b"), at(result, "c")]).toEqual(["lowlands", "lowlands", "lowlands"]);
  });

  it("lets a unit enter a territory a friendly unit is leaving, whether that unit leaves or bounces", () => {
    const scenario = tiny();
    const leaves = play(scenario, withUnits(scenario, [["a", "red", "westfold"], ["r", "red", "highlands"]]), [
      move("red", "a", "westfold", "highlands"),
      move("red", "r", "highlands", "harbor")
    ]);
    expect([resultOf(leaves, "a"), resultOf(leaves, "r")]).toEqual(["moved", "moved"]);
    expect([at(leaves, "a"), at(leaves, "r")]).toEqual(["highlands", "harbor"]);

    // r is stopped by Blue in the harbor; a still arrives, and r is not lost to its own side (M8).
    const bounces = play(scenario, withUnits(scenario, [["a", "red", "westfold"], ["r", "red", "highlands"], ["b", "blue", "harbor"]]), [
      move("red", "a", "westfold", "highlands"),
      move("red", "r", "highlands", "harbor")
    ]);
    expect([resultOf(bounces, "a"), resultOf(bounces, "r")]).toEqual(["moved", "bounced:held"]);
    expect([at(bounces, "a"), at(bounces, "r")]).toEqual(["highlands", "highlands"]);
  });

  it("lets friendly units swap territories without meeting head-on (M5 applies only to other factions)", () => {
    const scenario = tiny();
    const result = play(scenario, withUnits(scenario, [["a", "red", "westfold"], ["r", "red", "highlands"]]), [
      move("red", "a", "westfold", "highlands"),
      move("red", "r", "highlands", "westfold")
    ]);
    expect([resultOf(result, "a"), resultOf(result, "r")]).toEqual(["moved", "moved"]);
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

    // The head of the chain is held by Blue; the rest still advance and nobody is lost.
    const chain = play(scenario, withUnits(scenario, [["l", "red", "lowlands"], ["w", "red", "westfold"], ["h", "red", "highlands"], ["b", "blue", "harbor"]]), [
      move("red", "l", "lowlands", "westfold"),
      move("red", "w", "westfold", "highlands"),
      move("red", "h", "highlands", "harbor")
    ]);
    expect(["l", "w", "h"].map((id) => resultOf(chain, id))).toEqual(["moved", "moved", "bounced:held"]);
    expect(["l", "w", "h"].map((id) => at(chain, id))).toEqual(["westfold", "highlands", "highlands"]);
  });

  it("lets several friendly units reinforce a territory shared with a stationary hostile (OD-7)", () => {
    const scenario = spain();
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
    const result = play(scenario, withUnits(scenario, units), orders);
    expect([resultOf(result, "rep-sevilla-34"), resultOf(result, "rep-wad-ras-1")]).toEqual(["moved", "moved"]);
    expect(result.finalState.control[territory("andalucia")]?.kind).toBe("contested");

    // Control: without a friendly foothold the stationary hostile stops both (M4).
    const noFoothold = play(scenario, withUnits(scenario, units.slice(1)), orders);
    expect([resultOf(noFoothold, "rep-sevilla-34"), resultOf(noFoothold, "rep-wad-ras-1")]).toEqual(["bounced:held", "bounced:held"]);
  });

  it("keys the reinforcement exception on friendly units that hold, as M4 states", () => {
    // Decision pinned here: when the only friendly occupant is ordered out, the entering unit
    // faces the hostile holder alone and bounces, even if the occupant itself bounces back.
    const scenario = spain();
    const units = [
      ["rep-vitoria-8", "republic", "andalucia"],
      ["south-granada-6", "south", "andalucia"],
      ["rep-sevilla-34", "republic", "murcia"],
      ["south-legion", "south", "ceuta"]
    ] as const;
    const leaves = play(scenario, withUnits(scenario, units), [
      move("republic", "rep-vitoria-8", "andalucia", "extremadura"),
      move("republic", "rep-sevilla-34", "murcia", "andalucia")
    ]);
    expect([resultOf(leaves, "rep-vitoria-8"), resultOf(leaves, "rep-sevilla-34")]).toEqual(["moved", "bounced:held"]);
    expect(leaves.outcomes[1]).toMatchObject({ cause: { holdingFactionIds: ["south"], kind: "held" } });

    const staysBehind = play(scenario, withUnits(scenario, units), [
      move("republic", "rep-vitoria-8", "andalucia", "ceuta"),
      move("republic", "rep-sevilla-34", "murcia", "andalucia")
    ]);
    expect([resultOf(staysBehind, "rep-vitoria-8"), resultOf(staysBehind, "rep-sevilla-34")]).toEqual(["bounced:held", "bounced:held"]);
    expect([at(staysBehind, "rep-vitoria-8"), at(staysBehind, "rep-sevilla-34")]).toEqual(["andalucia", "murcia"]);
  });

  it("bounces friendly units moving together only because other factions move in too (M3, the reported case)", () => {
    const scenario = spain();
    const state = initialGameState(scenario);
    const together = [
      move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha"),
      move("republic", "rep-covadonga-4", "madrid", "castilla-la-mancha")
    ];
    const alone = play(scenario, state, together);
    expect([resultOf(alone, "rep-wad-ras-1"), resultOf(alone, "rep-covadonga-4")]).toEqual(["moved", "moved"]);

    const contested = play(scenario, state, [
      ...together,
      move("north", "north-aragon-17", "aragon", "castilla-la-mancha"),
      move("north", "north-san-marcial-22", "castilla-y-leon", "madrid"),
      move("south", "south-granada-6", "andalucia", "castilla-la-mancha"),
      move("south", "south-lepanto-5", "andalucia", "castilla-la-mancha")
    ]);
    for (const id of ["rep-wad-ras-1", "rep-covadonga-4"]) {
      expect(contested.outcomes.find((outcome) => "order" in outcome && outcome.order.unitId === id)).toMatchObject({
        capturedByFactionId: "north",
        cause: { kind: "standoff", opposingFactionIds: ["north", "south"] },
        kind: "disbanded-move"
      });
    }
    // The opposing factions never list the mover's own faction.
    expect(contested.outcomes.find((outcome) => "order" in outcome && outcome.order.unitId === "south-granada-6"))
      .toMatchObject({ cause: { kind: "standoff", opposingFactionIds: ["republic", "north"] } });
  });

  it("bounces a friendly mover into a friendly-held territory only when a hostile also moves in (M3)", () => {
    const scenario = tiny();
    const result = play(scenario, withUnits(scenario, [["c", "red", "lowlands"], ["a", "red", "westfold"], ["b", "blue", "harbor"]]), [
      move("red", "a", "westfold", "lowlands"),
      move("blue", "b", "harbor", "lowlands")
    ]);
    expect([resultOf(result, "a"), resultOf(result, "b"), resultOf(result, "c")]).toEqual(["bounced:standoff", "bounced:standoff", "no order"]);
    expect(result.outcomes[0]).toMatchObject({ cause: { opposingFactionIds: ["blue"] } });
    expect([at(result, "a"), at(result, "b"), at(result, "c")]).toEqual(["westfold", "harbor", "lowlands"]);
  });

  it("keeps a friendly swap intact for the unit no hostile contests", () => {
    const scenario = tiny();
    const result = play(scenario, withUnits(scenario, [["a", "red", "westfold"], ["r", "red", "highlands"], ["b", "blue", "harbor"]]), [
      move("red", "a", "westfold", "highlands"),
      move("red", "r", "highlands", "westfold"),
      move("blue", "b", "harbor", "highlands")
    ]);
    expect(["a", "r", "b"].map((id) => resultOf(result, id))).toEqual(["bounced:standoff", "moved", "bounced:standoff"]);
    // a bounces home, where its friend r arrived: no loss, they share Westfold (M8).
    expect([at(result, "a"), at(result, "r")]).toEqual(["westfold", "westfold"]);
  });

  it("lets a friendly unit follow into a territory a hostile failed to leave, without stopping the friend that met it head-on", () => {
    const scenario = tiny();
    const result = play(scenario, withUnits(scenario, [["a", "red", "westfold"], ["c", "red", "harbor"], ["b", "blue", "highlands"]]), [
      move("red", "a", "westfold", "highlands"),
      move("red", "c", "harbor", "highlands"),
      move("blue", "b", "highlands", "westfold")
    ]);
    expect(["a", "c", "b"].map((id) => resultOf(result, id))).toEqual(["bounced:head-on", "moved", "lost:head-on"]);
    expect([at(result, "a"), at(result, "c"), at(result, "b")]).toEqual(["westfold", "highlands", undefined]);
  });
});

describe("friendly consolidation (planning and computer players)", () => {
  it("offers friendly-held territories as destinations for several selected units", () => {
    const scenario = spain();
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
    // Valencia x2 and Madrid x2 -> Castilla-La Mancha, all four into one territory.
    moveAll("valencia", "castilla-la-mancha");
    moveAll("madrid", "castilla-la-mancha");
    const session = store.getState().game.session;
    expect(session.phase === "planning" && session.draft.feedback).toBeUndefined();
    expect(session.phase === "planning" && session.draft.orders.map((order) => `${order.unitId}->${order.to}`)).toEqual([
      "rep-sevilla-34->valencia",
      "rep-otumba-9->castilla-la-mancha",
      "rep-guadalajara-10->castilla-la-mancha",
      "rep-wad-ras-1->castilla-la-mancha",
      "rep-covadonga-4->castilla-la-mancha"
    ]);
  });

  it("lets computer players stack units: crowding is a preference, not a rule", () => {
    const scenario = spain();
    const state = withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"], ["rep-otumba-9", "republic", "castilla-la-mancha"]]);
    expect(legalMoves(scenario, state, state.units[unit("rep-wad-ras-1")]!).map((order) => order.to)).toContain("castilla-la-mancha");

    const initial = initialGameState(scenario);
    const stacked = Array.from({ length: 20 }, (_, seed) =>
      generateComputerSubmission(scenario, initial, faction("south"), seededRandom(deriveSeed(seed, 1, 2))))
      .some((submission) => new Set(submission.orders.map((order) => order.to)).size < submission.orders.length);
    expect(stacked).toBe(true);
  });
});

/** The reported case: two Republican regiments leave Madrid together while both insurgent commands also march on Castilla-La Mancha. */
function reportedCase(capture: boolean): TurnResolutionResult {
  const scenario = spain();
  return play(scenario, initialGameState(scenario), [
    move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha"),
    move("republic", "rep-covadonga-4", "madrid", "castilla-la-mancha"),
    move("north", "north-aragon-17", "aragon", "castilla-la-mancha"),
    ...(capture ? [move("north", "north-san-marcial-22", "castilla-y-leon", "madrid")] : []),
    move("south", "south-granada-6", "andalucia", "castilla-la-mancha"),
    move("south", "south-lepanto-5", "andalucia", "castilla-la-mancha")
  ]);
}

const lines = (result: TurnResolutionResult) =>
  groupOutcomes(result.outcomes).map((group) => describeOutcomeGroup(spain(), group, result.outcomes));

describe("friendly consolidation (turn report)", () => {
  afterEach(cleanup);

  it("reports formations that moved together as one line that names the faction and every opposing origin", () => {
    expect(lines(reportedCase(false))).toEqual([
      "Republican Government: Wad-Ras Infantry Regiment No. 1 and Covadonga Infantry Regiment No. 4 tried to move together from Madrid to Castilla-La Mancha and bounced: standoff with Northern Insurgent Command (from Aragon) and Southern Insurgent Command (from Andalucia).",
      "Northern Insurgent Command: Aragon Infantry Regiment No. 17 tried to move from Aragon to Castilla-La Mancha and bounced: standoff with Republican Government (from Madrid) and Southern Insurgent Command (from Andalucia).",
      "Southern Insurgent Command: Granada Infantry Regiment No. 6 and Lepanto Infantry Regiment No. 5 tried to move together from Andalucia to Castilla-La Mancha and bounced: standoff with Republican Government (from Madrid) and Northern Insurgent Command (from Aragon)."
    ]);
  });

  it("reports a group lost to a capture of its origin, and the capture itself", () => {
    expect(lines(reportedCase(true)).slice(0, 2)).toEqual([
      "Republican Government: Wad-Ras Infantry Regiment No. 1 and Covadonga Infantry Regiment No. 4 were lost. They tried to move together from Madrid to Castilla-La Mancha and bounced: standoff with Northern Insurgent Command (from Aragon) and Southern Insurgent Command (from Andalucia). Northern Insurgent Command took Madrid.",
      "Northern Insurgent Command: Aragon Infantry Regiment No. 17 tried to move from Aragon to Castilla-La Mancha and bounced: standoff with Republican Government (from Madrid) and Southern Insurgent Command (from Andalucia)."
    ]);
    expect(lines(reportedCase(true))).toContain("Northern Insurgent Command: San Marcial Infantry Regiment No. 22 moved from Castilla y Leon to Madrid.");
  });

  it("groups only same-faction, same-route, same-result outcomes and lists several origins of one faction", () => {
    const scenario = spain();
    const result = play(scenario, withUnits(scenario, [
      ["rep-wad-ras-1", "republic", "madrid"],
      ["rep-covadonga-4", "republic", "madrid"],
      ["south-granada-6", "south", "andalucia"],
      ["south-legion", "south", "extremadura"]
    ]), [
      move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha"),
      move("republic", "rep-covadonga-4", "madrid", "castilla-y-leon"),
      move("south", "south-granada-6", "andalucia", "castilla-la-mancha"),
      move("south", "south-legion", "extremadura", "castilla-la-mancha")
    ]);
    expect(groupOutcomes(result.outcomes).map((group) => group.unitIds)).toEqual([
      ["rep-wad-ras-1"], ["rep-covadonga-4"], ["south-granada-6"], ["south-legion"], []
    ]);
    expect(lines(result)[0]).toBe("Republican Government: Wad-Ras Infantry Regiment No. 1 tried to move from Madrid to Castilla-La Mancha and bounced: standoff with Southern Insurgent Command (from Andalucia and Extremadura).");
    expect(lines(result)[1]).toBe("Republican Government: Covadonga Infantry Regiment No. 4 moved from Madrid to Castilla y Leon.");
    // Without the turn's outcomes the standoff still names the faction.
    expect(describeOutcome(scenario, result.outcomes[0]!)).toContain("bounced: standoff with Southern Insurgent Command.");
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
    render(<OutcomeSummary result={reportedCase(false)} scenario={spain()} />);
    const bounced = screen.getByText("Bounced (5)").closest("details");
    expect(within(bounced!).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText(/A faction's own armies never block each other/)).toBeVisible();
    cleanup();

    const scenario = spain();
    render(<OutcomeSummary result={play(scenario, initialGameState(scenario), [move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha"), move("republic", "rep-covadonga-4", "madrid", "castilla-la-mancha")])} scenario={scenario} />);
    expect(screen.getByText("Completed moves (2)")).toBeDefined();
    expect(screen.queryByText(/never block each other/)).toBeNull();
  });

  it("never counts another faction's formations in a route badge", () => {
    const routes = groupRoutes([], reportedCase(true).outcomes);
    expect(routes.filter((route) => route.to === "castilla-la-mancha").map((route) => [route.kind, route.factionId, route.from, route.count])).toEqual([
      ["disbanded", "republic", "madrid", 2],
      ["bounced", "north", "aragon", 1],
      ["bounced", "south", "andalucia", 2]
    ]);
  });
});
