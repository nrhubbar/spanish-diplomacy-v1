import { createListenerMiddleware, type UnknownAction } from "@reduxjs/toolkit";
import type { RootState } from "./store";

type Heard = (before: RootState, after: RootState, action: UnknownAction) => void;

/** One store's own listener, so nothing hears another store. Until `listen` is called it costs nothing. */
export function createAudioMiddleware() {
  const { middleware, startListening } = createListenerMiddleware<RootState>();
  return {
    /** Calls back after every action, in the same task (so inside the click), with the state before and after it. */
    listen: (heard: Heard): (() => void) => {
      const stop = startListening({
        effect: (action, api) => { heard(api.getOriginalState(), api.getState(), action); },
        predicate: () => true
      });
      return () => { stop(); };
    },
    middleware
  };
}
