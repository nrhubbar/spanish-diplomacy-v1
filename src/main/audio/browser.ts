import type { ScenarioRegistry } from "../scenarios/registry";
import { setMuted } from "../state/audioSlice";
import type { AppStore } from "../state/store";
import { startSound } from "./start";
import { createWebAudioOutput } from "./webAudio";

/** A headset's or keyboard's media keys mute and unmute the music, as its button in Settings does. */
function listenToMediaKeys(store: AppStore): void {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: "Spanish Diplomacy" });
  navigator.mediaSession.setActionHandler("pause", () => { store.dispatch(setMuted({ channel: "music", muted: true })); });
  navigator.mediaSession.setActionHandler("play", () => { store.dispatch(setMuted({ channel: "music", muted: false })); });
}

/** Loaded after the first screen, so sound is no part of the first download. Returns a stop. */
export function startBrowserSound(store: AppStore, registry: ScenarioRegistry): () => void {
  listenToMediaKeys(store);
  return startSound({
    document,
    now: () => performance.now(),
    output: createWebAudioOutput(),
    registry,
    storage: () => window.localStorage,
    store
  });
}
