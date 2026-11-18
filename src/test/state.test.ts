import { describe, expect, it } from "vitest";
import {
  addDraftMove,
  beginPlanning,
  chooseMoveAction,
  chooseMoveDestination,
  enterSetup,
  removeDraftOrder,
  selectActiveFaction,
  selectAllAvailableUnitsInTerritory,
  selectDraftOrders,
  selectGamePhase,
  selectSubmissionStatus,
  selectRevealedOrders,
  selectTerritory,
  selectUnit,
  setActorKind,
  startNewGame,
  startNextTurn,
  submitCurrentOrders
} from "../main/state/gameSlice";
import { createAppStore } from "../main/state/store";

describe("game state orchestration", () => {
  it("enters setup and edits actor assignments", () => {
    const store = createAppStore();
    store.dispatch(enterSetup());
    store.dispatch(setActorKind({ factionId: "north", kind: "local-human" }));
    expect(selectGamePhase(store.getState())).toBe("setup");
    expect(store.getState().game.assignments.north).toBe("local-human");
  });

  it("runs a mixed game directly through planning, AI, and resolution", () => {
    const store = createAppStore();
    store.dispatch(startNewGame({ republic: "local-human", north: "computer", south: "computer" }));
    expect(selectGamePhase(store.getState())).toBe("planning");
    store.dispatch(selectTerritory("madrid"));
    store.dispatch(selectUnit("rep-wad-ras-1"));
    store.dispatch(chooseMoveAction());
    store.dispatch(chooseMoveDestination("castilla-la-mancha"));
    store.dispatch(addDraftMove());
    expect(selectDraftOrders(store.getState())).toHaveLength(1);
    store.dispatch(submitCurrentOrders());
    expect(selectGamePhase(store.getState())).toBe("resolution");
    expect(selectSubmissionStatus(store.getState()).every((status) => status.ready)).toBe(true);
    store.dispatch(startNextTurn());
    expect(selectGamePhase(store.getState())).toBe("planning");
    expect(store.getState().game.turnNumber).toBe(2);
    expect(store.getState().game.history).toHaveLength(1);
  });

  it("hands off between local players without revealing submissions", () => {
    const store = createAppStore();
    store.dispatch(startNewGame({ republic: "local-human", north: "local-human", south: "computer" }));
    store.dispatch(beginPlanning());
    store.dispatch(submitCurrentOrders());
    expect(selectGamePhase(store.getState())).toBe("handoff");
    expect(selectActiveFaction(store.getState()).id).toBe("north");
    expect(selectSubmissionStatus(store.getState())[0]).toMatchObject({ ready: true });
  });

  it("runs all computer commanders through the normal submission gateway", () => {
    const store = createAppStore();
    store.dispatch(startNewGame({ republic: "computer", north: "computer", south: "computer" }));
    expect(["resolution", "game-over"]).toContain(selectGamePhase(store.getState()));
    expect(selectSubmissionStatus(store.getState()).every((status) => status.ready)).toBe(true);
    expect(["resolution", "game-over"]).toContain(selectGamePhase(store.getState()));
  });

  it("toggles individual stacked units and supports removing draft orders", () => {
    const store = createAppStore();
    store.dispatch(startNewGame({ republic: "local-human", north: "computer", south: "computer" }));
    store.dispatch(beginPlanning());
    store.dispatch(selectUnit("rep-wad-ras-1"));
    store.dispatch(selectUnit("rep-covadonga-4"));
    expect(store.getState().game.selectedUnitIds).toHaveLength(2);
    store.dispatch(selectUnit("rep-wad-ras-1"));
    expect(store.getState().game.selectedUnitIds).toEqual(["rep-covadonga-4"]);
    store.dispatch(selectUnit("rep-otumba-9"));
    expect(store.getState().game.selectedUnitIds).toEqual(["rep-otumba-9"]);
    store.dispatch(selectUnit("rep-wad-ras-1"));
    store.dispatch(selectUnit("rep-covadonga-4"));
    store.dispatch(chooseMoveAction());
    store.dispatch(chooseMoveDestination("castilla-la-mancha"));
    store.dispatch(addDraftMove());
    expect(selectDraftOrders(store.getState())).toHaveLength(2);
    store.dispatch(removeDraftOrder("rep-wad-ras-1"));
    expect(selectDraftOrders(store.getState())).toHaveLength(1);
  });

  it("selects every available formation and prevents a second order for one unit", () => {
    const store = createAppStore();
    store.dispatch(startNewGame({ republic: "local-human", north: "computer", south: "computer" }));
    store.dispatch(selectTerritory("madrid"));
    store.dispatch(selectAllAvailableUnitsInTerritory());
    expect(store.getState().game.selectedUnitIds.length).toBeGreaterThan(1);
    store.dispatch(chooseMoveAction());
    store.dispatch(chooseMoveDestination("castilla-la-mancha"));
    store.dispatch(addDraftMove());
    const orderedUnitId = selectDraftOrders(store.getState())[0]!.unitId;
    store.dispatch(selectUnit(orderedUnitId));
    expect(store.getState().game.selectedUnitIds).toHaveLength(0);
    expect(store.getState().game.validationMessage).toContain("planned order");
  });

  it("reports select-all edge cases", () => {
    const store = createAppStore();
    store.dispatch(startNewGame({ republic: "local-human", north: "computer", south: "computer" }));
    store.dispatch(selectAllAvailableUnitsInTerritory());
    expect(store.getState().game.validationMessage).toContain("territory");
    store.dispatch(selectTerritory("madrid"));
    store.dispatch(selectAllAvailableUnitsInTerritory());
    store.dispatch(chooseMoveAction());
    store.dispatch(chooseMoveDestination("castilla-la-mancha"));
    store.dispatch(addDraftMove());
    store.dispatch(selectTerritory("madrid"));
    store.dispatch(selectAllAvailableUnitsInTerritory());
    expect(store.getState().game.validationMessage).toContain("already has an order");
  });

  it("uses saved assignments when starting without a payload and describes hold submissions after reveal", () => {
    const store = createAppStore();
    store.dispatch(setActorKind({ factionId: "north", kind: "local-human" }));
    store.dispatch(startNewGame(undefined));
    store.dispatch(beginPlanning());
    store.dispatch(submitCurrentOrders());
    expect(selectRevealedOrders(store.getState())[0]?.description).toBe("All formations held");
  });

  it("enters game over when a submitted turn reaches the territory threshold", () => {
    const baseStore = createAppStore();
    const base = baseStore.getState().game;
    const winningTerritories = ["galicia", "asturias", "cantabria", "pais-vasco", "navarra", "la-rioja", "madrid", "castilla-y-leon", "castilla-la-mancha", "catalunya"] as const;
    const control = { ...base.control };
    for (const territoryId of winningTerritories) control[territoryId] = { kind: "controlled", factionId: "republic" };
    const store = createAppStore({ game: {
      ...base,
      activeFactionId: "republic",
      assignments: { republic: "local-human", north: "computer", south: "computer" },
      control,
      phase: "planning",
      submittedOrders: { north: { factionId: "north", orders: [] }, south: { factionId: "south", orders: [] } }
    }});
    store.dispatch(submitCurrentOrders());
    expect(selectGamePhase(store.getState())).toBe("game-over");
    expect(store.getState().game.resolution?.victory?.factionIds).toEqual(["republic"]);
  });

  it("reports invalid selections and incomplete moves", () => {
    const store = createAppStore();
    store.dispatch(startNewGame({ republic: "local-human", north: "computer", south: "computer" }));
    store.dispatch(beginPlanning());
    store.dispatch(selectTerritory("galicia"));
    expect(store.getState().game.validationMessage).toContain("No friendly formations");
    store.dispatch(selectUnit("north-zamora-29"));
    expect(store.getState().game.validationMessage).toContain("own formations");
    store.dispatch(chooseMoveAction());
    store.dispatch(chooseMoveDestination("galicia"));
    store.dispatch(addDraftMove());
    expect(store.getState().game.validationMessage).toBeDefined();
  });

  it("keeps invalid phase commands and malformed drafts safely contained", () => {
    const store = createAppStore();
    store.dispatch(beginPlanning());
    store.dispatch(startNextTurn());
    store.dispatch(submitCurrentOrders());
    expect(selectGamePhase(store.getState())).toBe("idle");

    store.dispatch(startNewGame({ republic: "local-human", north: "computer", south: "computer" }));
    store.dispatch(chooseMoveDestination("madrid"));
    expect(store.getState().game.validationMessage).toContain("Choose units");
    store.dispatch(beginPlanning());
    store.dispatch(selectUnit("rep-wad-ras-1"));
    store.dispatch(chooseMoveAction());
    store.dispatch(chooseMoveDestination("madrid"));
    expect(store.getState().game.validationMessage).toContain("different territory");
    store.dispatch(addDraftMove());
    expect(store.getState().game.validationMessage).toContain("destination");
    store.dispatch(chooseMoveDestination("galicia"));
    expect(store.getState().game.validationMessage).toContain("not adjacent");
  });

  it("stops at an unavailable online actor", () => {
    const store = createAppStore();
    store.dispatch(startNewGame({ republic: "computer", north: "online-human", south: "local-human" }));
    expect(selectGamePhase(store.getState())).toBe("handoff");
    expect(selectActiveFaction(store.getState()).id).toBe("north");
    expect(store.getState().game.validationMessage).toContain("Online players");
  });
});
