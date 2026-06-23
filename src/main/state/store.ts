import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { counterReducer } from "./counterSlice";
import { notificationMiddleware } from "./notificationMiddleware";
import { notificationReducer } from "./notificationSlice";

export const rootReducer = combineReducers({
  counter: counterReducer,
  notifications: notificationReducer
});

export type RootState = ReturnType<typeof rootReducer>;

export function createAppStore(preloadedState?: Partial<RootState>) {
  if (preloadedState === undefined) {
    return configureStore({
      reducer: rootReducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().prepend(notificationMiddleware.middleware)
    });
  }

  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(notificationMiddleware.middleware),
    preloadedState
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore["dispatch"];
