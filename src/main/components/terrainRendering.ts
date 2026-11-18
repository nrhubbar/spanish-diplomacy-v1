export interface TerrainRenderMetrics {
  readonly anisotropy: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly width: number;
}

export const terrainRenderingConfig = {
  bumpScale: 0.15,
  displacementBias: -0.035,
  displacementScale: 0.13,
  maxAnisotropy: 8,
  maxPixelRatio: 1.5,
  meshColor: 0xd0c5aa,
  metalness: 0.02,
  roughness: 0.86,
  toneMappingExposure: 1.02
} as const;

export function terrainRenderMetrics(
  width: number,
  height: number,
  devicePixelRatio: number,
  availableAnisotropy: number
): TerrainRenderMetrics {
  return {
    anisotropy: Math.max(1, Math.min(terrainRenderingConfig.maxAnisotropy, availableAnisotropy)),
    height: Math.max(1, height),
    pixelRatio: Math.max(1, Math.min(terrainRenderingConfig.maxPixelRatio, devicePixelRatio)),
    width: Math.max(1, width)
  };
}

