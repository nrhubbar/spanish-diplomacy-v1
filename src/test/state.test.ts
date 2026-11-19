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
  toggleOrderMenu,
  toggleUnitSelection
} from "../main/state/gameSlice";
import { loadMapAssets } from "../main/state/mapAssetsSlice";
import { isPathAllowed, paths, routeForSession } from "../main/state/routing";
import { selectRevealedOrders, selectSubmissionStatus } from "../main/state/selectors";
import type { GameRecord, Session } from "../main/state/session";
import { createAppStore } from "../main/state/store";
import { initialGameState } from "../main/engine/resolution";
import { faction, spain, spainId, territory, testRegistry, testStore, tiny, tinyId, unit } from "./support";

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
      { abbreviation: "SIC", factionId: "south", name: "Southern Insurgent Command", ready: false }
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
    const run = (seed: number) => {
      const store = startWith({ republic: "computer" }, spainId, seed);
      const results: unknown[] = [];
      for (let turn = 0; turn < 6 && session(store).phase === "resolution"; turn += 1) {
        const current = session(store);
        if (current.phase === "resolution") results.push(current.result);
        store.dispatch(startNextTurn());
      }
      return results;
    };
    for (const seed of [1, 2, 3]) expect(run(seed)).toEqual(run(seed));
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
    expect(draftOf(store)).toMatchObject({ feedback: expect.stringContaining("None of your armies"), selectedTerritoryId: "galicia", selectedUnitIds: [] });
    store.dispatch(toggleUnitSelection(unit("rep-otumba-9")));
    expect(draftOf(store)).toMatchObject({ selectedTerritoryId: "valencia", selectedUnitIds: ["rep-otumba-9", "rep-guadalajara-10"] });
    store.dispatch(clickMapUnit(unit("no-such-unit")));
    expect(draftOf(store).selectedTerritoryId).toBe("valencia");
  });

  it("gives the selected armies an order through the order menu", () => {
    const store = startWith({});
    store.dispatch(clickMapTerritory(territory("valencia")));
    store.dispatch(toggleUnitSelection(unit("rep-otumba-9")));
    store.dispatch(toggleOrderMenu());
    expect(draftOf(store).stage).toEqual({ step: "choose-order" });
    store.dispatch(toggleOrderMenu());
    expect(draftOf(store).stage).toBeUndefined();
    store.dispatch(toggleOrderMenu());
    store.dispatch(chooseOrderKind("move"));
    expect(draftOf(store).stage).toEqual({ orderKind: "move", step: "choose-destination" });
    store.dispatch(clickMapTerritory(territory("castilla-la-mancha")));
    expect(draftOf(store)).toEqual({
      orders: [{ factionId: "republic", from: "valencia", kind: "move", to: "castilla-la-mancha", unitId: "rep-guadalajara-10" }],
      selectedTerritoryId: "valencia",
      selectedUnitIds: ["rep-otumba-9"]
    });
    store.dispatch(removePlannedOrder(unit("rep-guadalajara-10")));
    expect(draftOf(store).orders).toEqual([]);
  });

  it("closes the order menu whenever the selection changes", () => {
    const store = startWith({});
    store.dispatch(clickMapTerritory(territory("madrid")));
    for (const change of [toggleUnitSelection(unit("rep-wad-ras-1")), selectAllAvailableUnits(), clickMapTerritory(territory("valencia"))]) {
      store.dispatch(toggleOrderMenu());
      expect(draftOf(store).stage).toEqual({ step: "choose-order" });
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
    store.dispatch(toggleOrderMenu());
    expect(feedback()).toContain("at least one army");
    store.dispatch(chooseOrderKind("move"));
    expect(feedback()).toContain("at least one army");
    store.dispatch(clickMapTerritory(territory("galicia")));
    expect(feedback()).toContain("None of your armies");
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
    store.dispatch(toggleUnitSelection(unit("rep-wad-ras-1")));
    expect(feedback()).toContain("Remove this army's planned order");
    store.dispatch(clickMapTerritory(territory("madrid")));
    expect(feedback()).toContain("already has an order");
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

describe("routing (R5)", () => {
  it("maps each phase to one path and allows settings outside games", () => {
    const store = startWith({});
    expect(routeForSession({ phase: "idle" })).toBe(paths.home);
    expect(routeForSession(session(store))).toBe(paths.orders);
    expect(isPathAllowed({ phase: "idle" }, paths.settings)).toBe(true);
    expect(isPathAllowed(session(store), paths.settings)).toBe(false);
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
