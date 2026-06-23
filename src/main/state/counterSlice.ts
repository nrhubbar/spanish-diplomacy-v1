import { createSlice } from "@reduxjs/toolkit";
import type { RootState } from "./store";

export interface CounterState {
  readonly value: number;
}

const initialState: CounterState = {
  value: 0
};

const counterSlice = createSlice({
  name: "counter",
  initialState,
  reducers: {
    decrement: (state) => {
      state.value -= 1;
    },
    increment: (state) => {
      state.value += 1;
    }
  }
});

export const { decrement, increment } = counterSlice.actions;
export const counterReducer = counterSlice.reducer;

export function selectCounterValue(state: RootState): number {
  return state.counter.value;
}
