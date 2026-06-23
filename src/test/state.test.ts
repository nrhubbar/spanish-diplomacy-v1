import { describe, expect, it } from "vitest";
import { decrement, increment, selectCounterValue } from "../main/state/counterSlice";
import { goToCounter, goToStart, selectScreen } from "../main/state/navigationSlice";
import { createAppStore } from "../main/state/store";

describe("app store", () => {
  it("uses the start screen and zero counter by default", () => {
    const store = createAppStore();

    expect(selectScreen(store.getState())).toBe("start");
    expect(selectCounterValue(store.getState())).toBe(0);
  });

  it("accepts injected preloaded state", () => {
    const store = createAppStore({
      counter: { value: 4 },
      navigation: { screen: "counter" }
    });

    expect(selectScreen(store.getState())).toBe("counter");
    expect(selectCounterValue(store.getState())).toBe(4);
  });

  it("updates navigation through actions", () => {
    const store = createAppStore();

    store.dispatch(goToCounter());
    expect(selectScreen(store.getState())).toBe("counter");

    store.dispatch(goToStart());
    expect(selectScreen(store.getState())).toBe("start");
  });

  it("updates the counter through actions", () => {
    const store = createAppStore();

    store.dispatch(increment());
    store.dispatch(increment());
    store.dispatch(decrement());

    expect(selectCounterValue(store.getState())).toBe(1);
  });
});
