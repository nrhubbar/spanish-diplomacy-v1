import { combineReducers, configureStore } from "@reduxjs/toolkit";
import type { ScenarioRegistry } from "../scenarios/registry";
import type { GameClient } from "../game/client";
import { createAudioMiddleware } from "./audioMiddleware";
import { audioSlice } from "./audioSlice";
import { briefingSlice } from "./briefingSlice";
import { createClientMiddleware } from "./clientMiddleware";
import { commandRefused, createGameReducer, viewReceived } from "./gameSlice";
import { mapAssetsSlice } from "./mapAssetsSlice";
import { mapLayersSlice } from "./mapLayersSlice";
import { notificationMiddleware } from "./notificationMiddleware";
import { notificationReducer } from "./notificationSlice";
import { paneSlice } from "./paneSlice";
import { timerSlice } from "./timerSlice";

export function createRootReducer(registry: ScenarioRegistry) {
  return combineReducers({
    audio: audioSlice.reducer,
    briefing: briefingSlice.reducer,
    game: createGameReducer({ registry }),
    mapAssets: mapAssetsSlice.reducer,
    mapLayers: mapLayersSlice.reducer,
    notifications: notificationReducer,
    pane: paneSlice.reducer,
    timer: timerSlice.reducer
  });
}

export type RootState = ReturnType<ReturnType<typeof createRootReducer>>;

export interface AppStoreOptions {
  /** Whoever runs the games. Without one (a screen drawn on its own) commands go nowhere. */
  readonly client?: GameClient;
  readonly preloadedState?: Partial<RootState>;
  readonly registry: ScenarioRegistry;
}

/** Store factory; the scenario registry is injected so tests and fixtures can swap packages. */
export function createAppStore({ client, preloadedState, registry }: AppStoreOptions) {
  const audio = createAudioMiddleware();
  const store = configureStore({
    // m4: in hot-seat play the extension would show one player's plans to the next.
    devTools: import.meta.env.DEV,
    reducer: createRootReducer(registry),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: { extraArgument: { registry } } }).prepend(notificationMiddleware.middleware, audio.middleware).concat(createClientMiddleware(client)),
    ...(preloadedState === undefined ? {} : { preloadedState })
  });
  client?.subscribe((event) => { store.dispatch(event.kind === "view" ? viewReceived(event.view) : commandRefused({ refusal: event.refusal, ...(event.turnNumber === undefined ? {} : { turnNumber: event.turnNumber }) })); });
  return Object.assign(store, { listenToActions: audio.listen });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore["dispatch"];
