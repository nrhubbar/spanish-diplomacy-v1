import { combineReducers, configureStore } from "@reduxjs/toolkit";
import type { ScenarioRegistry } from "../scenarios/registry";
import { briefingSlice } from "./briefingSlice";
import { createGameReducer } from "./gameSlice";
import { mapAssetsSlice } from "./mapAssetsSlice";
import { notificationMiddleware } from "./notificationMiddleware";
import { notificationReducer } from "./notificationSlice";
import { timerSlice } from "./timerSlice";

export function createRootReducer(registry: ScenarioRegistry) {
  return combineReducers({
    briefing: briefingSlice.reducer,
    game: createGameReducer({ registry }),
    mapAssets: mapAssetsSlice.reducer,
    notifications: notificationReducer,
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
  return configureStore({
    reducer: createRootReducer(registry),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: { extraArgument: { registry } } }).prepend(notificationMiddleware.middleware),
    ...(preloadedState === undefined ? {} : { preloadedState })
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore["dispatch"];
