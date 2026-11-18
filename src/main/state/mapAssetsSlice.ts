import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { ScenarioId } from "../engine/types";
import type { ScenarioRegistry } from "../scenarios/registry";

export type MapAssetStatus = "loading" | "ready" | "failed";

export interface MapAssetsState {
  readonly status: Readonly<Record<string, MapAssetStatus>>;
}

export interface ThunkExtra {
  readonly registry: ScenarioRegistry;
}

/** Loads a scenario's map geometry, symbols, and terrain. Rejections surface as notifications. */
export const loadMapAssets = createAsyncThunk<ScenarioId, ScenarioId, { extra: ThunkExtra }>(
  "mapAssets/load",
  async (scenarioId, { extra }) => {
    try {
      await extra.registry.loadAssets(scenarioId);
    } catch (error) {
      throw new Error(`The map for this scenario could not be loaded. ${error instanceof Error ? error.message : ""}`.trim(), { cause: error });
    }
    return scenarioId;
  },
  {
    condition: (scenarioId, { getState }) => {
      const status = (getState() as { readonly mapAssets: MapAssetsState }).mapAssets.status[scenarioId];
      return status !== "loading" && status !== "ready";
    }
  }
);

const initialState: MapAssetsState = { status: {} };

export const mapAssetsSlice = createSlice({
  name: "mapAssets",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadMapAssets.pending, (state, action) => ({ status: { ...state.status, [action.meta.arg]: "loading" } }))
      .addCase(loadMapAssets.fulfilled, (state, action) => ({ status: { ...state.status, [action.meta.arg]: "ready" } }))
      .addCase(loadMapAssets.rejected, (state, action) => ({ status: { ...state.status, [action.meta.arg]: "failed" } }));
  }
});
