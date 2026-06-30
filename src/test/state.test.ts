import type { UnknownAction } from "@reduxjs/toolkit";
import { describe, expect, it, vi } from "vitest";
import {
  chooseMoveAction,
  chooseMoveDestination,
  enterSetup,
  selectActiveFaction,
  selectCanSubmit,
  selectGamePhase,
  selectHistory,
  selectLegalDestinationIds,
  selectSelectedDestinationId,
  selectSelectedFromTerritoryId,
  selectSelectedUnitIds,
  selectSubmittedOrders,
  selectTerritory,
  selectTurnDate,
  selectUnits,
  selectValidationMessage,
  startNewGame,
  startNextTurn,
  submitCurrentOrder,
  selectUnit
} from "../main/state/gameSlice";
import {
  addErrorNotification,
  addInfoNotification,
  addWarningNotification,
  removeNotification,
  selectNotifications
} from "../main/state/notificationSlice";
import { createAppStore } from "../main/state/store";

describe("app store", () => {
  it("starts idle with no notifications", () => {
    const store = createAppStore();

    expect(selectGamePhase(store.getState())).toBe("idle");
    expect(selectNotifications(store.getState())).toEqual([]);
  });

  it("accepts injected preloaded state", () => {
    const store = createAppStore({
      game: {
        activeFactionId: "roy",
        control: { center: "com" },
        draftAction: undefined,
        history: [],
        phase: "orders",
        resolution: undefined,
        selectedDestinationId: undefined,
        selectedFromTerritoryId: undefined,
        selectedUnitIds: [],
        submittedOrders: {},
        turnNumber: 2,
        units: {
          "com-inf-001": {
            displayName: "1st International Infantry",
            factionId: "com",
            id: "com-inf-001",
            territoryId: "center",
            type: "infantry"
          }
        },
        validationMessage: undefined
      },
      notifications: {
        notifications: [{ id: "known", message: "Loaded", tone: "info" }]
      }
    });

    expect(selectActiveFaction(store.getState()).name).toBe("Player 2");
    expect(selectNotifications(store.getState())).toHaveLength(1);
  });

  it("runs a full local turn and starts the next turn with history", () => {
    const store = createAppStore();

    store.dispatch(startNewGame());
    store.dispatch(selectTerritory("north"));
    store.dispatch(chooseMoveAction());
    store.dispatch(chooseMoveDestination("center"));
    store.dispatch(submitCurrentOrder());

    expect(selectActiveFaction(store.getState()).name).toBe("Player 2");
    expect(selectSubmittedOrders(store.getState())[0]?.description).toBe(
      "Move com-inf-001 from North to Center"
    );

    store.dispatch(selectTerritory("southwest"));
    store.dispatch(chooseMoveAction());
    store.dispatch(chooseMoveDestination("center"));
    store.dispatch(submitCurrentOrder());
    store.dispatch(submitCurrentOrder());

    expect(selectGamePhase(store.getState())).toBe("resolution");
    expect(selectUnits(store.getState()).find((unit) => unit.id === "com-inf-001")?.territoryId).toBe(
      "north"
    );

    store.dispatch(startNextTurn());

    expect(selectGamePhase(store.getState())).toBe("orders");
    expect(selectActiveFaction(store.getState()).name).toBe("Player 1");
    expect(selectHistory(store.getState())).toHaveLength(1);
    expect(selectTurnDate(store.getState())).toBe("late January 1930");
  });

  it("enters setup and validates incomplete move drafts", () => {
    const store = createAppStore();

    store.dispatch(enterSetup());
    expect(selectGamePhase(store.getState())).toBe("setup");

    store.dispatch(startNewGame());
    store.dispatch(chooseMoveAction());

    expect(selectValidationMessage(store.getState())).toBe("Select at least one friendly unit first.");
    expect(selectCanSubmit(store.getState())).toBe(true);
  });

  it("selects a from territory and destination", () => {
    const store = createAppStore();

    store.dispatch(startNewGame());
    store.dispatch(selectTerritory("north"));
    store.dispatch(chooseMoveAction());
    store.dispatch(chooseMoveDestination("center"));

    expect(selectSelectedDestinationId(store.getState())).toBe("center");
    expect(selectLegalDestinationIds(store.getState())).toEqual(["center", "southwest", "eastern-port"]);
    expect(selectCanSubmit(store.getState())).toBe(true);

    store.dispatch(chooseMoveDestination("north"));

    expect(selectSelectedDestinationId(store.getState())).toBeUndefined();
  });

  it("warns when selecting a destination before a valid move draft", () => {
    const store = createAppStore();

    store.dispatch(startNewGame());
    store.dispatch(chooseMoveDestination("center"));

    expect(selectValidationMessage(store.getState())).toBe("Choose a from territory and move action first.");
    expect(selectLegalDestinationIds(store.getState())).toEqual([]);
  });

  it("rejects impossible destination payloads", () => {
    const store = createAppStore();

    store.dispatch(startNewGame());
    store.dispatch(selectTerritory("north"));
    store.dispatch(chooseMoveAction());
    store.dispatch(chooseMoveDestination("unknown" as "center"));

    expect(selectSelectedDestinationId(store.getState())).toBeUndefined();
    expect(selectValidationMessage(store.getState())).toBe("Destination is not adjacent.");
  });

  it("selects an owned unit and rejects enemy units", () => {
    const store = createAppStore();

    store.dispatch(startNewGame());
    store.dispatch(selectUnit("com-inf-001"));

    expect(selectSelectedFromTerritoryId(store.getState())).toBe("north");
    expect(selectSelectedUnitIds(store.getState())).toEqual(["com-inf-001"]);

    store.dispatch(selectUnit("roy-inf-001"));

    expect(selectValidationMessage(store.getState())).toBe("Select one of your own units.");
  });

  it("prevents corrupted invalid draft orders from submitting", () => {
    const store = createAppStore({
      game: {
        activeFactionId: "com",
        control: { north: "com", southwest: "roy", "eastern-port": "fas" },
        draftAction: "move",
        history: [],
        phase: "orders",
        resolution: undefined,
        selectedDestinationId: "center",
        selectedFromTerritoryId: "southwest",
        selectedUnitIds: ["com-inf-001"],
        submittedOrders: {},
        turnNumber: 1,
        units: {
          "com-inf-001": {
            displayName: "1st International Infantry",
            factionId: "com",
            id: "com-inf-001",
            territoryId: "north",
            type: "infantry"
          }
        },
        validationMessage: undefined
      },
      notifications: {
        notifications: []
      }
    });

    store.dispatch(submitCurrentOrder());

    expect(selectValidationMessage(store.getState())).toBe("Selected unit is no longer in that territory.");
    expect(selectSubmittedOrders(store.getState())).toEqual([]);
  });

  it("treats a move draft without a from territory as an empty submission", () => {
    const store = createAppStore({
      game: {
        activeFactionId: "com",
        control: { north: "com" },
        draftAction: "move",
        history: [],
        phase: "orders",
        resolution: undefined,
        selectedDestinationId: "center",
        selectedFromTerritoryId: undefined,
        selectedUnitIds: ["com-inf-001"],
        submittedOrders: {},
        turnNumber: 1,
        units: {
          "com-inf-001": {
            displayName: "1st International Infantry",
            factionId: "com",
            id: "com-inf-001",
            territoryId: "north",
            type: "infantry"
          }
        },
        validationMessage: undefined
      },
      notifications: {
        notifications: []
      }
    });

    store.dispatch(submitCurrentOrder());

    expect(selectSubmittedOrders(store.getState())[0]?.description).toBe("No orders");
  });

  it("can clear draft state without a stored resolution", () => {
    const store = createAppStore();

    store.dispatch(startNextTurn());

    expect(selectGamePhase(store.getState())).toBe("orders");
    expect(selectHistory(store.getState())).toEqual([]);
  });

  it("derives calendar labels from the turn number", () => {
    const store = createAppStore({
      game: {
        activeFactionId: "com",
        control: {},
        draftAction: undefined,
        history: [],
        phase: "orders",
        resolution: undefined,
        selectedDestinationId: undefined,
        selectedFromTerritoryId: undefined,
        selectedUnitIds: [],
        submittedOrders: {},
        turnNumber: 25,
        units: {},
        validationMessage: undefined
      },
      notifications: {
        notifications: []
      }
    });

    expect(selectTurnDate(store.getState())).toBe("early January 1931");
  });

  it("adds and removes notifications", () => {
    const store = createAppStore();

    store.dispatch(addInfoNotification("Info message"));
    store.dispatch(addWarningNotification("Warning message"));
    store.dispatch(addErrorNotification("Error message"));

    const notifications = selectNotifications(store.getState());

    expect(notifications.map((notification) => notification.tone)).toEqual([
      "info",
      "warning",
      "error"
    ]);

    store.dispatch(removeNotification(notifications[0]?.id ?? ""));

    expect(selectNotifications(store.getState())).toHaveLength(2);
  });

  it("turns rejected actions into error notifications", async () => {
    const store = createAppStore();
    const rejectedAction = {
      type: "scenario/load/rejected",
      error: { message: "Scenario failed to load." },
      meta: { requestId: "scenario-1", requestStatus: "rejected" }
    } satisfies UnknownAction;

    store.dispatch(rejectedAction);

    await vi.waitFor(() => {
      expect(selectNotifications(store.getState())[0]?.message).toBe("Scenario failed to load.");
    });
  });

  it("uses a fallback message for rejected actions without an error message", async () => {
    const store = createAppStore();
    const rejectedAction = {
      type: "scenario/load/rejected",
      error: {},
      meta: { requestId: "scenario-2", requestStatus: "rejected" }
    } satisfies UnknownAction;

    store.dispatch(rejectedAction);

    await vi.waitFor(() => {
      expect(selectNotifications(store.getState())[0]?.message).toBe(
        "Unexpected application error."
      );
    });
  });
});
