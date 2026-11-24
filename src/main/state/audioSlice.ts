import { createAction, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { type Channel, clampLevel, defaultSettings, type SoundLevels, type SoundSettings } from "../audio/levels";
import type { RootState } from "./store";

export interface AudioState extends SoundSettings {
  /** The browser asks to save data, so music waits until the player turns it on. */
  readonly savingData: boolean;
}

const initialState: AudioState = { ...defaultSettings(false), savingData: false };

/** The player let go of a slider: one quiet tick shows the new level. */
export const previewSound = createAction("audio/previewSound");

/** The player's sound levels. Reducers stay pure: `audio/stored.ts` reads and keeps them in the browser. */
export const audioSlice = createSlice({
  initialState,
  name: "audio",
  reducers: {
    musicNoticeShown: (state) => ({ ...state, noticeSeen: true }),
    resetSound: (state) => ({ ...state, levels: defaultSettings(state.savingData).levels }),
    setLevel: (state, { payload }: PayloadAction<{ readonly channel: Channel; readonly level: number }>) => ({
      ...state,
      levels: { ...state.levels, [payload.channel]: { ...state.levels[payload.channel], level: clampLevel(payload.level) } }
    }),
    setMuted: (state, { payload }: PayloadAction<{ readonly channel: Channel; readonly muted: boolean }>) => ({
      ...state,
      levels: { ...state.levels, [payload.channel]: { ...state.levels[payload.channel], muted: payload.muted } }
    })
  }
});

export const { musicNoticeShown, resetSound, setLevel, setMuted } = audioSlice.actions;

export function selectSoundLevels(state: RootState): SoundLevels {
  return state.audio.levels;
}

export function selectSavingData(state: RootState): boolean {
  return state.audio.savingData;
}
