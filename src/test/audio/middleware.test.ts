import { expect, it, vi } from "vitest";
import { setLevel } from "../../main/state/audioSlice";
import { testStore } from "../support";

it("hears its own store's actions only, with the state before and after, until it stops", () => {
  const heard = vi.fn();
  const own = testStore();
  const stop = own.listenToActions(heard);
  testStore().dispatch(setLevel({ channel: "music", level: 5 }));
  expect(heard).not.toHaveBeenCalled();
  const before = own.getState();
  const action = setLevel({ channel: "music", level: 10 });
  own.dispatch(action);
  expect(heard).toHaveBeenCalledExactlyOnceWith(before, own.getState(), action);
  stop();
  own.dispatch(action);
  expect(heard).toHaveBeenCalledTimes(1);
});
