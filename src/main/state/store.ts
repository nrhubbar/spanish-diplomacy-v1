import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { counterReducer } from "./counterSlice";
import { navigationReducer } from "./navigationSlice";

export const rootReducer = combineReducers({
  counter: counterReducer,
  navigation: navigationReducer
});

export type RootState = ReturnType<typeof rootReducer>;

export function createAppStore(preloadedState?: Partial<RootState>) {
  if (preloadedState === undefined) {
    return configureStore({
      reducer: rootReducer
    });
  }

  return configureStore({
    reducer: rootReducer,
    preloadedState
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore["dispatch"];
