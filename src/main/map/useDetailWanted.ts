import { useEffect, useState } from "react";
import { connectionHint } from "../connection";
import type { MapRect } from "../scenarios/loader";
import type { TerrainLayerAsset } from "../scenarios/registry";
import { terrainRenderingConfig, wantsDetail } from "./terrainRendering";

/** Every relief layer once the detailed (last) one is wanted; until then all but it. */
export function layersToShow(layers: readonly TerrainLayerAsset[], detailWanted: boolean): readonly TerrainLayerAsset[] {
  return detailWanted || layers.length < 2 ? layers : layers.slice(0, -1);
}

/** True from the moment the detailed relief is of use, and from then on. */
export function useDetailWanted(layers: readonly TerrainLayerAsset[], visible: MapRect): boolean {
  const detail = layers.length < 2 ? undefined : layers[layers.length - 1];
  const [idle, setIdle] = useState(false);
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    if (idle) return undefined;
    // Each camera move starts the quiet time again.
    const timer = window.setTimeout(() => { setIdle(true); }, terrainRenderingConfig.detailIdleMs);
    return () => { window.clearTimeout(timer); };
  }, [idle, visible.height, visible.width, visible.x, visible.y]);
  const now = detail !== undefined && wantsDetail(visible, detail.bounds, idle, connectionHint());
  if (now && !wanted) setWanted(true);
  return wanted || now;
}
