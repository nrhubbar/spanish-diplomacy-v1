export interface MapCamera {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export interface MapViewport {
  readonly height: number;
  readonly width: number;
}

export const mapCameraConfig = {
  baseOverscan: 1.08,
  maxScale: 3,
  minScale: 1,
  zoomStep: 0.25
} as const;

export const initialMapCamera: MapCamera = { scale: 1, x: 0, y: 0 };

export function renderedMapScale(camera: MapCamera): number {
  return camera.scale * mapCameraConfig.baseOverscan;
}

export function mapSemanticLevel(scale: number): "detail" | "operational" | "overview" {
  if (scale >= 2.1) return "detail";
  if (scale >= 1.45) return "operational";
  return "overview";
}

export function clampMapCamera(camera: MapCamera, viewport: MapViewport): MapCamera {
  const scale = Math.min(mapCameraConfig.maxScale, Math.max(mapCameraConfig.minScale, camera.scale));
  const renderedScale = scale * mapCameraConfig.baseOverscan;
  const maxX = Math.max(0, (viewport.width * renderedScale - viewport.width) / 2);
  const maxY = Math.max(0, (viewport.height * renderedScale - viewport.height) / 2);

  return {
    scale,
    x: Math.min(maxX, Math.max(-maxX, camera.x)),
    y: Math.min(maxY, Math.max(-maxY, camera.y))
  };
}

export function panMapCamera(
  camera: MapCamera,
  deltaX: number,
  deltaY: number,
  viewport: MapViewport
): MapCamera {
  return clampMapCamera({ ...camera, x: camera.x + deltaX, y: camera.y + deltaY }, viewport);
}

export function zoomMapCamera(
  camera: MapCamera,
  requestedScale: number,
  focusX: number,
  focusY: number,
  viewport: MapViewport
): MapCamera {
  const scale = Math.min(mapCameraConfig.maxScale, Math.max(mapCameraConfig.minScale, requestedScale));
  const ratio = scale / camera.scale;
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;

  return clampMapCamera({
    scale,
    x: focusX - centerX - (focusX - centerX - camera.x) * ratio,
    y: focusY - centerY - (focusY - centerY - camera.y) * ratio
  }, viewport);
}
