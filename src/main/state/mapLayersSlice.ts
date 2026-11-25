import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { defaultLayers, type LayerId } from "../presentation/mapLayers";

export interface MapLayersState {
  /** U13: the player's choice of map layers, kept while the map screens come and go. */
  readonly chosen: readonly LayerId[];
}

const initialState: MapLayersState = { chosen: defaultLayers };

/** U13: the Map Layers toolbar's choice, so it survives the map remounting between turns and screens. */
export const mapLayersSlice = createSlice({
  initialState,
  name: "mapLayers",
  reducers: {
    mapLayersChosen: (_state, { payload }: PayloadAction<readonly LayerId[]>) => ({ chosen: payload })
  }
});

export const { mapLayersChosen } = mapLayersSlice.actions;
