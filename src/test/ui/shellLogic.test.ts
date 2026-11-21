import { describe, expect, it } from "vitest";
import { requireUnitState } from "../../main/engine/lookup";
import { raisedUnitId } from "../../main/engine/recruitment/rules";
import { initialGameState } from "../../main/engine/resolution";
import type { AirMissionOrder, BuildingId, BuildOrder, GameState, MoveOrder, RecruitOrder, SubTerritoryId, SystemOutcome, TurnOutcome, UnitTypeId } from "../../main/engine/types";
import { groupThisTurn, ordersGivenLine, thisTurnEntries } from "../../main/presentation/thisTurn";
import { eventCount, factionReportTitle, outcomeFaction, outcomesByFaction } from "../../main/screens/report/factions";
import { beginPlanning, endTurn, exitGame } from "../../main/state/gameSlice";
import { openView, type PaneView, paneSlice, popped, popView, pushed, pushView, resetPane, rootView, topView, viewKey } from "../../main/state/paneSlice";
import { armiesWithoutOrders, chooseOrder, clearSelection, type PlanningSession, selectTerritory, toggleUnit } from "../../main/state/planning";
import { emptyDraft } from "../../main/state/session";
import { faction, move, spain, spainId, spainWithAir, territory, unit } from "../support";

const madrid: PaneView = { id: territory("madrid"), kind: "territory" };
const valencia: PaneView = { id: territory("valencia"), kind: "territory", tab: "recruit" };
const lastTurn: PaneView = { kind: "lastTurn" };
const reduce = paneSlice.reducer;

describe("U3: the pane stack", () => {
  it("starts on This turn and pushes views, keeping one of each kind", () => {
    const start = reduce(undefined, { type: "init" });
    expect(start.stack).toEqual([rootView]);
    const two = reduce(start, pushView(madrid));
    expect(two.stack).toEqual([rootView, madrid]);
    // Clicking another territory replaces the first; another kind stacks on top.
    expect(reduce(two, pushView(valencia)).stack).toEqual([rootView, valencia]);
    const three = reduce(two, pushView(lastTurn));
    expect(three.stack).toEqual([rootView, madrid, lastTurn]);
    expect(reduce(three, pushView(valencia)).stack).toEqual([rootView, lastTurn, valencia]);
    expect(pushed(three.stack, rootView)).toEqual([rootView]);
  });

  it("pops back to the root and never past it", () => {
    expect(popped([rootView, madrid])).toEqual([rootView]);
    expect(popped([rootView])).toEqual([rootView]);
    expect(popped([])).toEqual([rootView]);
    const state = reduce({ stack: [rootView, madrid, lastTurn] }, popView());
    expect(state.stack).toEqual([rootView, madrid]);
    expect(topView(state.stack)).toEqual(madrid);
    expect(topView([])).toEqual(rootView);
  });

  it("opens top-bar views straight on top of This turn", () => {
    expect(reduce({ stack: [rootView, madrid] }, openView(lastTurn)).stack).toEqual([rootView, lastTurn]);
    expect(reduce({ stack: [rootView, madrid] }, openView(rootView)).stack).toEqual([rootView]);
  });

  it("starts over on a new turn, a new player or a new game", () => {
    const deep = { stack: [rootView, madrid, lastTurn] };
    for (const action of [resetPane(), endTurn(), beginPlanning(), exitGame()]) {
      expect(reduce(deep, action).stack).toEqual([rootView]);
    }
  });

  it("keys each view by what it shows", () => {
    expect(viewKey(rootView)).toBe("thisTurn");
    expect(viewKey(madrid)).toBe("territory:madrid:");
    expect(viewKey(valencia)).toBe("territory:valencia:recruit");
    expect(viewKey({ kind: "invade", target: territory("aragon") })).toBe("invade:aragon");
    expect(viewKey({ kind: "reinforce", target: territory("aragon") })).toBe("reinforce:aragon");
    expect(viewKey({ kind: "build", territory: territory("aragon") })).toBe("build:aragon:");
    expect(viewKey({ kind: "build", subTerritory: "huesca" as SubTerritoryId, territory: territory("aragon") })).toBe("build:aragon:huesca");
    expect(viewKey({ kind: "recruit", territory: territory("aragon") })).toBe("recruit:aragon");
    expect(viewKey({ kind: "building" })).toBe("building");
  });
});

function planning(state: GameState): PlanningSession {
  return { draft: emptyDraft, factionId: faction("republic"), game: { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state }, phase: "planning" };
}

describe("U2: the armies with no order", () => {
  it("lists the player's ground armies without a move, Replenish or stay order, place by place", () => {
    const scenario = spainWithAir();
    const start = planning(initialGameState(scenario));
    const all = armiesWithoutOrders(scenario, start);
    expect(all.length).toBeGreaterThan(3);
    expect(all.every((army) => army.factionId === "republic")).toBe(true);
    // Aircraft and generals are left out.
    expect(all.map((army) => army.id)).not.toContain("rep-breguet-bombers");
    expect(all.map((army) => army.id)).not.toContain("rep-general-miaja");
    const places = all.map((army) => scenario.territories.findIndex((entry) => entry.id === army.territoryId));
    expect(places).toEqual([...places].sort((a, b) => a - b));

    const opened = selectTerritory(start, territory("madrid"), scenario);
    const entrenched = chooseOrder(scenario, toggleUnit(clearSelection(opened), unit("rep-wad-ras-1"), scenario), "entrench");
    const moving: PlanningSession = { ...entrenched, draft: { ...entrenched.draft, orders: [move("republic", "rep-covadonga-4", "madrid", "castilla-la-mancha")], replenishments: [{ factionId: faction("republic"), kind: "replenish", unitId: unit("rep-madrid-security") }] } };
    const left = armiesWithoutOrders(scenario, moving).map((army) => army.id);
    expect(left).not.toContain("rep-wad-ras-1");
    expect(left).not.toContain("rep-covadonga-4");
    expect(left).not.toContain("rep-madrid-security");
    expect(left).toContain("rep-madrid-sierra-column");
  });
});

const republic = faction("republic");
const sub = (id: string): SubTerritoryId => id as SubTerritoryId;
const factory = { buildingId: "factory" as BuildingId, kind: "building" as const };

describe("U3: This turn's orders", () => {
  const scenario = spainWithAir();
  const state = initialGameState(scenario);
  const territoryOf = (id: string) => requireUnitState(state, unit(id)).territoryId;
  const moveOrder: MoveOrder = move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha");
  const withdraw = { ...move("republic", "rep-covadonga-4", "madrid", "valencia"), kind: "withdraw" as const };
  const raid: AirMissionOrder = { factionId: republic, kind: "air-mission", mission: { kind: "raid", subTerritoryId: sub("burgos") }, unitId: unit("rep-breguet-bombers") };
  const recon: AirMissionOrder = { factionId: republic, kind: "air-mission", mission: { kind: "recon", territoryId: territory("aragon") }, unitId: unit("rep-ni52-fighters") };
  const lostRaid: AirMissionOrder = { ...raid, mission: { kind: "raid", subTerritoryId: sub("nowhere") } };
  const militia = (where: string): RecruitOrder => ({ factionId: republic, kind: "recruit", territoryId: territory(where), unitTypeId: "militia-column" as UnitTypeId });
  const build: BuildOrder = { factionId: republic, kind: "build", project: factory, subTerritoryId: sub("girona") };
  const lostBuild: BuildOrder = { factionId: republic, kind: "build", project: { buildingId: "nothing" as BuildingId, kind: "building" }, subTerritoryId: sub("nowhere") };
  const entries = thisTurnEntries(scenario, {
    airOrders: [raid, recon, lostRaid, { factionId: republic, kind: "sack", unitId: unit("rep-general-miaja") }],
    builds: [build, lostBuild],
    orders: [moveOrder, withdraw],
    recruits: [militia("catalunya"), militia("catalunya"), militia("valencia")],
    replenishments: [{ factionId: republic, kind: "replenish", unitId: unit("rep-madrid-security") }]
  }, territoryOf);

  it("gives every order one line with its cancel", () => {
    expect(entries.map((entry) => [entry.title, entry.detail])).toEqual([
      [expect.any(String), "Move \u00b7 Madrid \u2192 Castilla-La Mancha"],
      [expect.any(String), "Withdraw \u00b7 Withdraw: Madrid \u2192 Valencia"],
      [expect.any(String), "Replenish \u00b7 Madrid"],
      [expect.any(String), "Raid \u00b7 Burgos (Castilla y Le\u00f3n)"],
      [expect.any(String), "Recon \u00b7 Arag\u00f3n"],
      [expect.any(String), "Raid \u00b7 nowhere"],
      [expect.any(String), "Sacked at the end of the turn"],
      [expect.stringMatching(/^2 \u00d7 .+ at Catalu\u00f1a$/u), expect.stringMatching(/^Recruit \u00b7 /u)],
      [expect.stringMatching(/ at Valencia$/u), expect.stringMatching(/^Recruit \u00b7 /u)],
      ["Factory at Girona", expect.stringMatching(/^Build \u00b7 /u)],
      ["nothing at nowhere", "Build"]
    ]);
    expect(entries[0]?.move).toEqual(moveOrder);
    expect(entries[1]?.move).toBeUndefined();
    expect(entries.map((entry) => entry.cancel.kind)).toEqual(["order", "order", "order", "air", "air", "air", "sack", "recruit", "recruit", "build", "build"]);
    expect(ordersGivenLine(2, entries)).toBe("Turn 2 \u00b7 12 orders given this turn");
    expect(ordersGivenLine(2, entries.slice(0, 1))).toBe("Turn 2 \u00b7 1 order given this turn");
    expect(ordersGivenLine(1, [])).toBe("Turn 1 \u00b7 no orders given yet");
  });

  it("groups them by type or by region", () => {
    expect(groupThisTurn(scenario, entries, "type").map((group) => [group.label, group.count])).toEqual([
      ["Unit orders", 3], ["Air missions", 4], ["Recruits", 3], ["Builds", 2]
    ]);
    const regions = groupThisTurn(scenario, entries, "region").map((group) => group.label);
    expect(regions[0]).toBe("Arag\u00f3n");
    expect(regions).toContain("Madrid");
    expect(regions.at(-1)).toBe("Elsewhere");
    expect(groupThisTurn(scenario, [], "type")).toEqual([]);
    expect(thisTurnEntries(spain(), { airOrders: [], orders: [] }, territoryOf)).toEqual([]);
  });
});

describe("U10: the report by faction", () => {
  const scenario = spainWithAir();
  const state = initialGameState(scenario);
  const militiaId = raisedUnitId(republic, "militia-column" as UnitTypeId, 3);
  const theirs: SystemOutcome = { demoralized: false, factionId: faction("south"), fatigue: 1, kind: "fatigue", unitId: unit("nat-x") };
  const ours: SystemOutcome = { factionId: republic, kind: "training-paused", territoryId: territory("catalunya"), unitId: militiaId };
  const ordered: SystemOutcome = { kind: "build-queued", order: { factionId: faction("north"), kind: "build", project: factory, subTerritoryId: sub("girona") }, paid: {}, position: 0 };
  const forfeited: SystemOutcome = { kind: "build-forfeited", lost: {}, newHolder: faction("south"), previousHolder: republic, project: factory, subTerritoryId: sub("girona") };
  const rail: SystemOutcome = { after: 1, before: 2, kind: "rail-damaged", subTerritoryId: sub("girona") };
  const lostRail: SystemOutcome = { ...rail, subTerritoryId: sub("nowhere") };
  const weather = { kind: "weather-rolled" } as unknown as TurnOutcome;
  const outcomes: readonly TurnOutcome[] = [theirs, ours, ordered, forfeited, rail, lostRail, weather];

  it("names each line's faction from its own fields", () => {
    expect(outcomes.map((outcome) => outcomeFaction(state, outcome))).toEqual([faction("south"), republic, faction("north"), republic, republic, undefined, undefined]);
  });

  it("puts the viewer first, then the scenario's order, then lines of no faction", () => {
    const north = outcomesByFaction(scenario, state, outcomes, faction("north"));
    expect(north.map((entry) => [entry.factionId, entry.outcomes.length])).toEqual([[faction("north"), 1], [republic, 3], [faction("south"), 1], [undefined, 1]]);
    // The weather has a section of its own, so it is not listed here.
    const shared = outcomesByFaction(scenario, state, outcomes, undefined);
    expect(shared.map((entry) => entry.factionId)).toEqual([republic, faction("north"), faction("south"), undefined]);
  });

  it("titles and counts each faction's part", () => {
    expect(factionReportTitle(scenario, republic, republic)).toBe("Republican Government (you)");
    expect(factionReportTitle(scenario, republic, faction("south"))).toBe("Republican Government");
    expect(factionReportTitle(scenario, undefined, republic)).toBe("Other events");
    expect(eventCount(1)).toBe("1 event");
    expect(eventCount(8)).toBe("8 events");
  });
});
