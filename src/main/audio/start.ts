import { viewedSession } from "../hooks";
import type { ScenarioRegistry } from "../scenarios/registry";
import type { AppStore, RootState } from "../state/store";
import { createDirector, type DirectorState, type SoundOutput } from "./director";
import { keepSound, type SoundStorage } from "./stored";

export interface SoundSources {
  readonly document: Document;
  readonly now: () => number;
  readonly output: SoundOutput;
  readonly registry: Pick<ScenarioRegistry, "require">;
  readonly storage: SoundStorage;
  readonly store: AppStore;
}

/** A press that browsers count as the player's own. */
const gestures = ["pointerdown", "pointerup", "keydown", "click"] as const;

/**
 * Starts listening, and keeps the levels whenever they change. The store already holds what the
 * browser kept (`storedSound`), and may have changed since: this loads after the first screen.
 * Returns a stop.
 */
export function startSound({ document, now, output, registry, storage, store }: SoundSources): () => void {
  keepSound(storage, store.getState().audio);
  const director = createDirector({
    dispatch: (action) => { store.dispatch(action); },
    now,
    output,
    scenarioOf: (id) => registry.require(id).scenario
  });
  const view = (state: RootState): DirectorState => ({ audio: state.audio, session: viewedSession(registry, state), timer: state.timer });
  const stopListening = store.listenToActions((before, after, action) => {
    director.heard(view(before), view(after), action);
    if (before.audio !== after.audio) keepSound(storage, after.audio);
  });
  const visibility = (): void => { director.setHidden(document.hidden, view(store.getState())); };
  document.addEventListener("visibilitychange", visibility);
  for (const gesture of gestures) document.addEventListener(gesture, director.gesture, { capture: true, passive: true });
  director.sync(view(store.getState()));
  return () => {
    stopListening();
    document.removeEventListener("visibilitychange", visibility);
    for (const gesture of gestures) document.removeEventListener(gesture, director.gesture, { capture: true });
  };
}
