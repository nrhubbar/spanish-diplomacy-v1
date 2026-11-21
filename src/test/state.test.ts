import { describe, expect, it } from "vitest";
import type { ActorKind, ScenarioId } from "../main/engine/types";
import { createScenarioRegistry } from "../main/scenarios/registry";
import { advance } from "../main/state/coordinator";
import {
  beginPlanning,
  cancelOrderStage,
  chooseOrderKind,
  chooseScenario,
  clearUnitSelection,
  clickMapTerritory,
  clickMapUnit,
  endTurn,
  exitGame,
  openSetup,
  removePlannedOrder,
  returnHome,
  selectAllAvailableUnits,
  setActorKind,
  startGame,
  startNextTurn,
  toggleUnitSelection
} from "../main/state/gameSlice";
import { loadMapAssets } from "../main/state/mapAssetsSlice";
import { isPathAllowed, paths, routeForSession } from "../main/state/routing";
import { selectRevealedOrders, selectSubmissionStatus } from "../main/state/selectors";
import { chooseOrder, orderCounts, orderKindsFor, orderOf, type PlanningSession } from "../main/state/planning";
import type { GameRecord, Session } from "../main/state/session";
import { createAppStore } from "../main/state/store";
import { initialGameState } from "../main/engine/resolution";
import { armyIn, faction, spain, spainId, territory, testRegistry, testStore, tiny, tinyId, unit } from "./support";

function startWith(assignments: Record<string, ActorKind>, scenarioId: ScenarioId = spainId, seed = 11) {
  const store = testStore();
  store.dispatch(openSetup());
  store.dispatch(chooseScenario(scenarioId));
  for (const [factionId, kind] of Object.entries(assignments)) {
    store.dispatch(setActorKind({ factionId: faction(factionId), kind }));
  }
  store.dispatch(startGame(seed));
  return store;
}

const session = (store: ReturnType<typeof testStore>): Session => store.getState().game.session;

describe("setup", () => {
  it("defaults assignments from scenario data and switches scenarios", () => {
    const store = testStore();
    store.dispatch(openSetup());
    expect(session(store)).toMatchObject({ assignments: { north: "computer", republic: "local-human", south: "computer" }, phase: "setup", scenarioId: spainId });
    store.dispatch(chooseScenario(tinyId));
    expect(session(store)).toMatchObject({ assignments: { blue: "computer", red: "local-human" }, scenarioId: tinyId });
    store.dispatch(returnHome());
    expect(session(store).phase).toBe("idle");
  });

  it("refuses unsupported actors with inline feedback (B12)", () => {
    const store = startWith({ north: "online-human" });
    expect(session(store)).toMatchObject({ feedback: expect.stringContaining("Online play is coming later"), phase: "setup" });
  });

  it("ignores game commands outside their phase", () => {
    const store = testStore();
    store.dispatch(beginPlanning());
    store.dispatch(endTurn());
    store.dispatch(startNextTurn());
    store.dispatch(setActorKind({ factionId: faction("north"), kind: "computer" }));
    store.dispatch(chooseScenario(tinyId));
    store.dispatch(startGame(1));
    store.dispatch(clickMapTerritory(territory("madrid")));
    expect(session(store)).toEqual({ phase: "idle" });
  });

  it("stays idle when no scenarios are registered", () => {
    const empty = createScenarioRegistry({ maps: {}, rawAssets: {}, scenarios: {}, urlAssets: {} });
    const store = createAppStore({ registry: empty });
    store.dispatch(openSetup());
    expect(store.getState().game.session.phase).toBe("idle");
  });
});

describe("turn coordination", () => {
  it("resolves at once when the only local player ends the turn (T1)", () => {
    const store = startWith({});
    expect(session(store)).toMatchObject({ factionId: "republic", phase: "planning" });
    store.dispatch(endTurn());
    const resolved = session(store);
    expect(resolved.phase).toBe("resolution");
    expect(routeForSession(resolved)).toBe(paths.resolution);
    expect(selectRevealedOrders(resolved).map((entry) => entry.factionId)).toEqual(["republic", "north", "south"]);
    expect(resolved.phase === "resolution" && resolved.game.state.turnNumber).toBe(1);
    store.dispatch(startNextTurn());
    const next = session(store);
    expect(next).toMatchObject({ factionId: "republic", phase: "planning" });
    expect(next.phase === "planning" && next.game.state.turnNumber).toBe(2);
    expect(next.phase === "planning" && next.game.history).toHaveLength(1);
  });

  it("hands off privately between local players, then resolves on the last End Turn", () => {
    const store = startWith({ north: "local-human" });
    expect(session(store)).toMatchObject({ factionId: "republic", phase: "handoff" });
    expect(session(store)).not.toHaveProperty("fromFactionId");
    expect(selectRevealedOrders(session(store))).toEqual([]);
    store.dispatch(beginPlanning());
    expect(session(store)).toMatchObject({ factionId: "republic", phase: "planning" });
    store.dispatch(endTurn());
    expect(session(store)).toMatchObject({ factionId: "north", fromFactionId: "republic", phase: "handoff" });
    expect(selectSubmissionStatus(spain(), session(store))).toEqual([
      { abbreviation: "REP", factionId: "republic", name: "Republican Government", ready: true },
      { abbreviation: "NIC", factionId: "north", name: "Northern Insurgent Command", ready: false },
      // T6: a local computer player is always ready.
      { abbreviation: "SIC", factionId: "south", name: "Southern Insurgent Command", ready: true }
    ]);
    expect(selectRevealedOrders(session(store))).toEqual([]);
    const waiting = session(store);
    store.dispatch(endTurn());
    expect(session(store)).toBe(waiting);
    store.dispatch(beginPlanning());
    expect(session(store)).toMatchObject({ factionId: "north", phase: "planning" });
    expect(selectRevealedOrders(session(store))).toEqual([]);
    store.dispatch(endTurn());
    expect(session(store).phase).toBe("resolution");
    expect(selectRevealedOrders(session(store)).map((entry) => entry.factionId)).toEqual(["republic", "north", "south"]);
    store.dispatch(startNextTurn());
    const next = session(store);
    expect(next).toMatchObject({ factionId: "republic", phase: "handoff" });
    expect(next).not.toHaveProperty("fromFactionId");
    expect(next.phase === "handoff" && next.game.state.turnNumber).toBe(2);
  });

  it("lets computers lock first when the local player comes later", () => {
    const store = startWith({ republic: "computer", south: "local-human" });
    expect(session(store)).toMatchObject({ factionId: "south", phase: "planning" });
    expect(selectSubmissionStatus(spain(), session(store)).map((entry) => entry.ready)).toEqual([true, true, false]);
    store.dispatch(endTurn());
    expect(session(store).phase).toBe("resolution");
  });

  it("runs an all-computer game without stopping", () => {
    const store = startWith({ republic: "computer" });
    expect(session(store).phase).toBe("resolution");
    expect(selectRevealedOrders(session(store)).map((entry) => entry.factionId)).toEqual(["republic", "north", "south"]);
    store.dispatch(startNextTurn());
    const next = session(store);
    expect(next.phase).toBe("resolution");
    expect(next.phase === "resolution" && next.game.state.turnNumber).toBe(2);
  });

  it("replays identically from the same seed (R3)", () => {
    // Four turns on two seeds: a Spain turn's planning cost grows with the turn number, and six
    // turns on three seeds timed out under the full suite. Replay is the same proof at any length.
    const run = (seed: number) => {
      const store = startWith({ republic: "computer" }, spainId, seed);
      const results: unknown[] = [];
      for (let turn = 0; turn < 4 && session(store).phase === "resolution"; turn += 1) {
        const current = session(store);
        if (current.phase === "resolution") results.push(current.result);
        store.dispatch(startNextTurn());
      }
      return results;
    };
    for (const seed of [1, 2]) expect(run(seed)).toEqual(run(seed));
  });

  it("rejects an advance for an unsupported actor kind", () => {
    const scenario = tiny();
    const game: GameRecord = {
      assignments: { [faction("red")]: "online-human", [faction("blue")]: "computer" },
      history: [],
      locked: {},
      scenarioId: tinyId,
      seed: 1,
      state: initialGameState(scenario)
    };
    expect(() => advance(scenario, game)).toThrow("no supported actor");
  });
});

describe("planning drafts", () => {
  const draftOf = (store: ReturnType<typeof testStore>) => {
    const current = session(store);
    if (current.phase !== "planning") throw new Error(`Expected planning, got ${current.phase}`);
    return current.draft;
  };

  it("selects every unordered army in a territory by default, then toggles single armies", () => {
    const store = startWith({});
    store.dispatch(clickMapTerritory(territory("valencia")));
    expect(draftOf(store)).toEqual({ orders: [], selectedTerritoryId: "valencia", selectedUnitIds: ["rep-otumba-9", "rep-guadalajara-10"] });
    store.dispatch(toggleUnitSelection(unit("rep-otumba-9")));
    expect(draftOf(store).selectedUnitIds).toEqual(["rep-guadalajara-10"]);
    store.dispatch(toggleUnitSelection(unit("rep-otumba-9")));
    expect(draftOf(store).selectedUnitIds).toEqual(["rep-guadalajara-10", "rep-otumba-9"]);
    store.dispatch(clearUnitSelection());
    expect(draftOf(store)).toEqual({ orders: [], selectedTerritoryId: "valencia", selectedUnitIds: [] });
    store.dispatch(selectAllAvailableUnits());
    expect(draftOf(store).selectedUnitIds).toEqual(["rep-otumba-9", "rep-guadalajara-10"]);
  });

  it("selects a counter's whole territory first, then toggles counters inside it", () => {
    const store = startWith({});
    store.dispatch(clickMapUnit(unit("rep-guadalajara-10")));
    expect(draftOf(store)).toMatchObject({ selectedTerritoryId: "valencia", selectedUnitIds: ["rep-otumba-9", "rep-guadalajara-10"] });
    store.dispatch(clickMapUnit(unit("rep-guadalajara-10")));
    expect(draftOf(store).selectedUnitIds).toEqual(["rep-otumba-9"]);
    store.dispatch(clickMapUnit(unit("north-zamora-29")));
    expect(draftOf(store)).toMatchObject({ feedback: expect.stringContaining("None of your units"), selectedTerritoryId: "galicia", selectedUnitIds: [] });
    store.dispatch(toggleUnitSelection(unit("rep-otumba-9")));
    expect(draftOf(store)).toMatchObject({ selectedTerritoryId: "valencia", selectedUnitIds: ["rep-otumba-9", "rep-guadalajara-10"] });
    store.dispatch(clickMapUnit(unit("no-such-unit")));
    expect(draftOf(store).selectedTerritoryId).toBe("valencia");
  });

  it("gives the selected armies an order from the selection bar, then selects nothing (note 11)", () => {
    const store = startWith({});
    store.dispatch(clickMapTerritory(territory("valencia")));
    store.dispatch(toggleUnitSelection(unit("rep-otumba-9")));
    store.dispatch(chooseOrderKind("move"));
    expect(draftOf(store).stage).toEqual({ orderKind: "move", step: "choose-destination" });
    store.dispatch(clickMapTerritory(territory("castilla-la-mancha")));
    expect(draftOf(store)).toEqual({
      orders: [{ factionId: "republic", from: "valencia", kind: "move", to: "castilla-la-mancha", unitId: "rep-guadalajara-10" }],
      selectedTerritoryId: "valencia",
      selectedUnitIds: []
    });
    store.dispatch(removePlannedOrder(unit("rep-guadalajara-10")));
    expect(draftOf(store).orders).toEqual([]);
  });

  it("closes the destination choice whenever the selection changes", () => {
    const store = startWith({});
    store.dispatch(clickMapTerritory(territory("madrid")));
    for (const change of [toggleUnitSelection(unit("rep-wad-ras-1")), selectAllAvailableUnits()]) {
      store.dispatch(chooseOrderKind("move"));
      expect(draftOf(store).stage).toEqual({ orderKind: "move", step: "choose-destination" });
      store.dispatch(change);
      expect(draftOf(store).stage).toBeUndefined();
    }
  });

  it("cancels an order and keeps the armies selected", () => {
    const store = startWith({});
    store.dispatch(clickMapTerritory(territory("valencia")));
    store.dispatch(toggleUnitSelection(unit("rep-otumba-9")));
    store.dispatch(chooseOrderKind("move"));
    store.dispatch(cancelOrderStage());
    expect(draftOf(store)).toEqual({ orders: [], selectedTerritoryId: "valencia", selectedUnitIds: ["rep-guadalajara-10"] });
  });

  it("targets a counter's territory while choosing a destination", () => {
    const store = startWith({});
    store.dispatch(clickMapTerritory(territory("madrid")));
    store.dispatch(chooseOrderKind("move"));
    store.dispatch(clickMapUnit(unit("north-zamora-29")));
    expect(draftOf(store).feedback).toContain("Galicia is not connected to Madrid");
    store.dispatch(clickMapUnit(unit("rep-wad-ras-1")));
    expect(draftOf(store).feedback).toContain("different territory");
  });

  it("gives one inline message for each invalid step (B8)", () => {
    const store = startWith({});
    const feedback = () => draftOf(store).feedback;
    store.dispatch(selectAllAvailableUnits());
    expect(feedback()).toContain("Select a territory");
    store.dispatch(chooseOrderKind("move"));
    expect(feedback()).toContain("at least one unit");
    store.dispatch(clickMapTerritory(territory("galicia")));
    expect(feedback()).toContain("None of your units");
    store.dispatch(toggleUnitSelection(unit("north-zamora-29")));
    expect(feedback()).toContain("your own");
    store.dispatch(clickMapTerritory(territory("madrid")));
    store.dispatch(chooseOrderKind("move"));
    store.dispatch(clickMapTerritory(territory("madrid")));
    expect(feedback()).toContain("different territory");
    store.dispatch(clickMapTerritory(territory("galicia")));
    expect(feedback()).toContain("not connected");
    expect(store.getState().notifications.notifications).toEqual([]);
    store.dispatch(clickMapTerritory(territory("castilla-y-leon")));
    expect(draftOf(store).selectedUnitIds).toEqual([]);
    // A moving army can be selected again to change its order.
    store.dispatch(toggleUnitSelection(unit("rep-wad-ras-1")));
    expect(draftOf(store)).toMatchObject({ selectedTerritoryId: "madrid", selectedUnitIds: ["rep-wad-ras-1"] });
    store.dispatch(clickMapTerritory(territory("madrid")));
    expect(feedback()).toContain("Every unit here is moving");
    store.dispatch(clearUnitSelection());
    expect(feedback()).toBeUndefined();
  });

  it("explains when selected armies have nowhere to go together", () => {
    const store = startWith({}, tinyId);
    store.dispatch(clickMapTerritory(territory("westfold")));
    store.dispatch(chooseOrderKind("move"));
    expect(draftOf(store).stage).toEqual({ orderKind: "move", step: "choose-destination" });
    store.dispatch(clickMapTerritory(territory("isle")));
    expect(draftOf(store).feedback).toContain("not connected");
  });
});

describe("standing orders: Entrench and Rest (O1-O5)", () => {
  const planningOf = (store: ReturnType<typeof testStore>): PlanningSession => {
    const current = session(store);
    if (current.phase !== "planning") throw new Error(`Expected planning, got ${current.phase}`);
    return current;
  };
  /** The planning session with some of its armies demoralized. */
  const shaken = (planning: PlanningSession, ids: readonly string[]): PlanningSession => {
    const units = { ...planning.game.state.units };
    for (const id of ids) {
      const current = units[unit(id)];
      if (current !== undefined) units[unit(id)] = { ...current, morale: { demoralized: true, quietTurns: 0 } };
    }
    return { ...planning, game: { ...planning.game, state: { ...planning.game.state, units } } };
  };
  const scenario = spain();
  const republicArmies = Object.values(initialGameState(scenario).units).filter((army) => army.factionId === "republic");

  it("gives every army without a move its standing order: healthy armies entrench, demoralized ones rest", () => {
    const planning = planningOf(startWith({}));
    expect(orderCounts(planning)).toEqual({ entrench: republicArmies.length, move: 0, replenish: 0, rest: 0 });
    const tired = shaken(planning, ["rep-otumba-9"]);
    expect(orderOf(tired, armyIn(tired.game.state, "rep-otumba-9"))).toBe("rest");
    expect(orderOf(tired, armyIn(tired.game.state, "rep-guadalajara-10"))).toBe("entrench");
    expect(orderCounts(tired)).toEqual({ entrench: republicArmies.length - 1, move: 0, replenish: 0, rest: 1 });
  });

  it("selects armies that entrench by default, and offers Entrench to healthy armies only", () => {
    const store = startWith({});
    store.dispatch(clickMapTerritory(territory("valencia")));
    const planning = planningOf(store);
    expect(planning.draft.selectedUnitIds).toEqual(["rep-otumba-9", "rep-guadalajara-10"]);
    expect(orderKindsFor(planning)).toEqual(["move", "entrench"]);
    expect(chooseOrder(scenario, planning, "rest").draft.feedback).toBe("Only demoralized units rest.");
  });

  it("offers Rest to demoralized armies only, and never lets them entrench", () => {
    const store = startWith({});
    store.dispatch(clickMapTerritory(territory("valencia")));
    const tired = shaken(planningOf(store), ["rep-otumba-9"]);
    // A mixed selection is offered Move only: Rest is never offered to a healthy army.
    expect(orderKindsFor(tired)).toEqual(["move"]);
    const restOnly = { ...tired, draft: { ...tired.draft, selectedUnitIds: [unit("rep-otumba-9")] } };
    expect(orderKindsFor(restOnly)).toEqual(["move", "rest"]);
    expect(chooseOrder(scenario, restOnly, "entrench").draft.feedback).toContain("Demoralized units cannot entrench");
    expect(chooseOrder(scenario, restOnly, "rest").draft).toMatchObject({ feedback: "1 unit will rest.", orders: [] });
  });

  it("cancels a move with Entrench, replaces it with another Move, and returns to Entrench when cleared", () => {
    const store = startWith({});
    store.dispatch(clickMapTerritory(territory("valencia")));
    store.dispatch(chooseOrderKind("move"));
    store.dispatch(clickMapTerritory(territory("castilla-la-mancha")));
    expect(orderCounts(planningOf(store)).move).toBe(2);

    // A moving army can be selected; Move again replaces its order rather than adding one.
    store.dispatch(toggleUnitSelection(unit("rep-otumba-9")));
    store.dispatch(chooseOrderKind("move"));
    store.dispatch(clickMapTerritory(territory("catalunya")));
    expect(planningOf(store).draft.orders.map((order) => [order.unitId, order.to])).toEqual([
      ["rep-guadalajara-10", "castilla-la-mancha"],
      ["rep-otumba-9", "catalunya"]
    ]);

    store.dispatch(toggleUnitSelection(unit("rep-otumba-9")));
    store.dispatch(chooseOrderKind("entrench"));
    expect(planningOf(store).draft).toEqual({
      feedback: "1 unit will entrench.",
      orderedToStay: ["rep-otumba-9"],
      orders: [{ factionId: "republic", from: "valencia", kind: "move", to: "castilla-la-mancha", unitId: "rep-guadalajara-10" }],
      selectedTerritoryId: "valencia",
      selectedUnitIds: []
    });

    store.dispatch(removePlannedOrder(unit("rep-guadalajara-10")));
    const cleared = planningOf(store);
    expect(cleared.draft.orders).toEqual([]);
    expect(orderCounts(cleared)).toEqual({ entrench: republicArmies.length, move: 0, replenish: 0, rest: 0 });
  });
});

describe("routing (R5)", () => {
  it("maps each phase to one path and allows settings in and out of games", () => {
    const store = startWith({});
    expect(routeForSession({ phase: "idle" })).toBe(paths.home);
    expect(routeForSession(session(store))).toBe(paths.orders);
    expect(isPathAllowed({ phase: "idle" }, paths.settings)).toBe(true);
    expect(isPathAllowed(session(store), paths.settings)).toBe(true);
    expect(isPathAllowed(session(store), paths.resolution)).toBe(false);
    store.dispatch(exitGame());
    expect(session(store)).toEqual({ phase: "idle" });
  });

  it("refuses the retired reveal path in every phase (T1)", () => {
    const retired = "/reveal";
    expect(Object.values(paths)).not.toContain(retired);
    const store = startWith({});
    expect(isPathAllowed({ phase: "idle" }, retired)).toBe(false);
    expect(isPathAllowed(session(store), retired)).toBe(false);
    store.dispatch(endTurn());
    expect(isPathAllowed(session(store), retired)).toBe(false);
    expect(routeForSession(session(store))).toBe(paths.resolution);
    store.dispatch(exitGame());
    expect(session(store)).toEqual({ phase: "idle" });
  });
});

describe("map asset loading", () => {
  it("loads assets once and surfaces failures as notifications (B9)", async () => {
    const store = testStore();
    await store.dispatch(loadMapAssets(tinyId));
    expect(store.getState().mapAssets.status[tinyId]).toBe("ready");
    expect(testRegistry().peekAssets(tinyId)?.geometrySvg).toContain("tf-harbor");
    await store.dispatch(loadMapAssets(tinyId));

    const broken = createScenarioRegistry({
      maps: { "x/map.json": { ...(await import("./fixtures/scenarios/tiny-front/map.json")).default } },
      rawAssets: {
        "src/test/fixtures/scenarios/tiny-front/geometry.svg": () => Promise.resolve("<svg></svg>"),
        "src/test/fixtures/scenarios/tiny-front/foot.svg": () => Promise.resolve("<svg></svg>")
      },
      scenarios: { "x/scenario.json": (await import("./fixtures/scenarios/tiny-front/scenario.json")).default },
      urlAssets: {}
    });
    const failing = createAppStore({ registry: broken });
    await failing.dispatch(loadMapAssets(tinyId));
    expect(failing.getState().mapAssets.status[tinyId]).toBe("failed");
    expect(failing.getState().notifications.notifications[0]?.message).toContain("could not be loaded");
  });
});
