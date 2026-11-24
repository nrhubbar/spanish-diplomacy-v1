import { combineReducers, configureStore } from "@reduxjs/toolkit";
import type { ScenarioRegistry } from "../scenarios/registry";
import { createAudioMiddleware } from "./audioMiddleware";
import { audioSlice } from "./audioSlice";
import { briefingSlice } from "./briefingSlice";
import { createGameReducer } from "./gameSlice";
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
  readonly preloadedState?: Partial<RootState>;
  readonly registry: ScenarioRegistry;
}

/** Store factory; the scenario registry is injected so tests and fixtures can swap packages. */
export function createAppStore({ preloadedState, registry }: AppStoreOptions) {
  const audio = createAudioMiddleware();
  const store = configureStore({
    // m4: the extension would show every faction's locked orders and treasuries in hot-seat play.
    devTools: import.meta.env.DEV,
    reducer: createRootReducer(registry),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: { extraArgument: { registry } } }).prepend(notificationMiddleware.middleware, audio.middleware),
    ...(preloadedState === undefined ? {} : { preloadedState })
  });
  return Object.assign(store, { listenToActions: audio.listen });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore["dispatch"];
