import { createSlice } from "@reduxjs/toolkit";
import type { RootState } from "./store";

export type Screen = "start" | "counter";

export interface NavigationState {
  readonly screen: Screen;
}

const initialState: NavigationState = {
  screen: "start"
};

const navigationSlice = createSlice({
  name: "navigation",
  initialState,
  reducers: {
    goToCounter: (state) => {
      state.screen = "counter";
    },
    goToStart: (state) => {
      state.screen = "start";
    }
  }
});

export const { goToCounter, goToStart } = navigationSlice.actions;
export const navigationReducer = navigationSlice.reducer;

export function selectScreen(state: RootState): Screen {
  return state.navigation.screen;
}
