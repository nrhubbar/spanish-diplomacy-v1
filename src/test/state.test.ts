import type { UnknownAction } from "@reduxjs/toolkit";
import { describe, expect, it, vi } from "vitest";
import { decrement, increment, selectCounterValue } from "../main/state/counterSlice";
import {
  addErrorNotification,
  addInfoNotification,
  addWarningNotification,
  removeNotification,
  selectNotifications
} from "../main/state/notificationSlice";
import { createAppStore } from "../main/state/store";

describe("app store", () => {
  it("uses a zero counter and no notifications by default", () => {
    const store = createAppStore();

    expect(selectCounterValue(store.getState())).toBe(0);
    expect(selectNotifications(store.getState())).toEqual([]);
  });

  it("accepts injected preloaded state", () => {
    const store = createAppStore({
      counter: { value: 4 },
      notifications: {
        notifications: [{ id: "known", message: "Loaded", tone: "info" }]
      }
    });

    expect(selectCounterValue(store.getState())).toBe(4);
    expect(selectNotifications(store.getState())).toHaveLength(1);
  });

  it("updates the counter through actions", () => {
    const store = createAppStore();

    store.dispatch(increment());
    store.dispatch(increment());
    store.dispatch(decrement());

    expect(selectCounterValue(store.getState())).toBe(1);
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
