import type { UnknownAction } from "@reduxjs/toolkit";
import { describe, expect, it, vi } from "vitest";
import {
  chooseMoveDestination,
  enterSetup,
  selectActiveFaction,
  selectGamePhase,
  selectSelectedDestinationId,
  selectResolutionSummary,
  selectSubmittedOrders,
  selectUnits,
  selectValidationMessage,
  startNewGame,
  startNextTurn,
  submitMove,
  submitNoMove
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
        activeFactionId: "player-2",
        phase: "orders",
        resolution: undefined,
        selectedDestinationId: undefined,
        selectedTerritoryId: undefined,
        submittedOrders: {},
        turnNumber: 2,
        units: {
          "soldier-1": {
            id: "soldier-1",
            factionId: "player-1",
            type: "soldier",
            territoryId: "center"
          },
          "soldier-2": {
            id: "soldier-2",
            factionId: "player-2",
            type: "soldier",
            territoryId: "southwest"
          },
          "soldier-3": {
            id: "soldier-3",
            factionId: "player-3",
            type: "soldier",
            territoryId: "eastern-port"
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

  it("runs a full local turn and starts the next turn", () => {
    const store = createAppStore();

    store.dispatch(startNewGame());
    store.dispatch(chooseMoveDestination("center"));
    store.dispatch(submitMove());

    expect(selectActiveFaction(store.getState()).name).toBe("Player 2");
    expect(selectSubmittedOrders(store.getState())[0]?.description).toBe(
      "Move from North to Center"
    );

    store.dispatch(chooseMoveDestination("center"));
    store.dispatch(submitMove());
    store.dispatch(submitNoMove());

    expect(selectGamePhase(store.getState())).toBe("resolution");
    expect(selectResolutionSummary(store.getState()).join(" ")).toContain("bounced");
    expect(selectUnits(store.getState()).find((unit) => unit.id === "soldier-1")?.territoryId).toBe(
      "north"
    );

    store.dispatch(startNextTurn());

    expect(selectGamePhase(store.getState())).toBe("orders");
    expect(selectActiveFaction(store.getState()).name).toBe("Player 1");
    expect(store.getState().game.turnNumber).toBe(2);
  });

  it("enters setup and validates missing move destinations", () => {
    const store = createAppStore();

    store.dispatch(enterSetup());
    expect(selectGamePhase(store.getState())).toBe("setup");

    store.dispatch(startNewGame());
    store.dispatch(submitMove());

    expect(selectValidationMessage(store.getState())).toBe("Choose a legal move destination first.");
  });

  it("selects the active origin without choosing a destination", () => {
    const store = createAppStore();

    store.dispatch(startNewGame());
    store.dispatch(chooseMoveDestination("center"));
    expect(selectSelectedDestinationId(store.getState())).toBe("center");

    store.dispatch(chooseMoveDestination("north"));
    expect(selectSelectedDestinationId(store.getState())).toBeUndefined();
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
