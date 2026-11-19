import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { FactionId } from "../engine/types";
import { exitGame, startGame } from "./gameSlice";

export interface BriefingState {
  /** Factions whose turn-1 Briefing has opened by itself in the current game (B4). */
  readonly autoOpenedFor: readonly FactionId[];
}

const initialState: BriefingState = { autoOpenedFor: [] };

/**
 * Remembers which players have already been shown their Briefing, so it opens by itself once
 * per player and never again after it is closed, however often the map screen remounts.
 */
export const briefingSlice = createSlice({
  extraReducers: (builder) => {
    builder
      .addCase(startGame, () => initialState)
      .addCase(exitGame, () => initialState);
  },
  initialState,
  name: "briefing",
  reducers: {
    briefingAutoOpened: (state, { payload }: PayloadAction<FactionId>) =>
      state.autoOpenedFor.includes(payload) ? state : { autoOpenedFor: [...state.autoOpenedFor, payload] }
  }
});

export const { briefingAutoOpened } = briefingSlice.actions;
