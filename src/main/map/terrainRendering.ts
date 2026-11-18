import type { MapRect } from "../scenarios/loader";

export const terrainRenderingConfig = {
  maxAnisotropy: 8,
  maxPixelRatio: 2,
  /** Wait after the first relief layer is drawn before loading the finer, larger layers. */
  refineDelayMs: 400,
  /** Wait after the map mounts before starting WebGL; the first layer's image shows meanwhile. */
  startDelayMs: 300
} as const;

export interface TerrainRenderMetrics {
  readonly anisotropy: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly width: number;
}

/** Drawing-buffer size from the element's layout box, never from transformed bounds (V2). */
export function terrainRenderMetrics(
  layoutWidth: number,
  layoutHeight: number,
  devicePixelRatio: number,
  availableAnisotropy: number
): TerrainRenderMetrics {
  return {
    anisotropy: Math.max(1, Math.min(terrainRenderingConfig.maxAnisotropy, availableAnisotropy)),
    height: Math.max(1, Math.round(layoutHeight)),
    pixelRatio: Math.max(1, Math.min(terrainRenderingConfig.maxPixelRatio, devicePixelRatio)),
    width: Math.max(1, Math.round(layoutWidth))
  };
}

/**
 * Orthographic frustum for the visible map rectangle. The terrain plane spans the view box in
 * world units with y flipped (map y grows downward, world y grows upward).
 */
export function terrainFrustum(visible: MapRect): { bottom: number; left: number; right: number; top: number } {
  return { bottom: -(visible.y + visible.height), left: visible.x, right: visible.x + visible.width, top: -visible.y };
}
