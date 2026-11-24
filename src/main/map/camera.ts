import type { MapPoint, MapRect } from "../scenarios/loader";

/**
 * Camera in map coordinates. `zoom` is relative to the scale that fits the map's focus area
 * into the unobscured viewport, so a camera stays meaningful across resizes.
 */
export interface Camera {
  readonly centerX: number;
  readonly centerY: number;
  readonly zoom: number;
}

export interface Viewport {
  readonly height: number;
  /** Height of a bottom overlay (the mobile pane bar) that framing should avoid. */
  readonly insetBottom: number;
  /** Width of the right-hand overlay (the open pane) that framing should avoid. */
  readonly insetRight: number;
  readonly width: number;
}

export interface ViewportInsets {
  readonly bottom: number;
  readonly right: number;
}

export interface CameraBounds {
  readonly content: MapRect;
  readonly focus: MapRect;
}

export type SemanticLevel = "overview" | "operational" | "detail";

export const cameraLimits = { maxZoom: 4, minZoom: 1, zoomStep: 0.25 } as const;

function fitScale(viewport: Viewport, bounds: CameraBounds): number {
  const usableWidth = Math.max(1, viewport.width - viewport.insetRight);
  const usableHeight = Math.max(1, viewport.height - viewport.insetBottom);
  return Math.max(0.0001, Math.min(usableWidth / bounds.focus.width, usableHeight / bounds.focus.height));
}

export function pixelsPerUnit(camera: Camera, viewport: Viewport, bounds: CameraBounds): number {
  return fitScale(viewport, bounds) * camera.zoom;
}

/** Frames the focus area in the part of the viewport the pane does not cover. */
export function initialCamera(viewport: Viewport, bounds: CameraBounds): Camera {
  const scale = fitScale(viewport, bounds);
  return {
    centerX: bounds.focus.x + bounds.focus.width / 2 + viewport.insetRight / 2 / scale,
    centerY: bounds.focus.y + bounds.focus.height / 2 + viewport.insetBottom / 2 / scale,
    zoom: 1
  };
}

export function clampCamera(camera: Camera, bounds: CameraBounds): Camera {
  const { content } = bounds;
  return {
    centerX: Math.min(content.x + content.width, Math.max(content.x, camera.centerX)),
    centerY: Math.min(content.y + content.height, Math.max(content.y, camera.centerY)),
    zoom: Math.min(cameraLimits.maxZoom, Math.max(cameraLimits.minZoom, camera.zoom))
  };
}

export function visibleRect(camera: Camera, viewport: Viewport, bounds: CameraBounds): MapRect {
  const scale = pixelsPerUnit(camera, viewport, bounds);
  const width = viewport.width / scale;
  const height = viewport.height / scale;
  return { height, width, x: camera.centerX - width / 2, y: camera.centerY - height / 2 };
}

export function mapToScreen(point: MapPoint, camera: Camera, viewport: Viewport, bounds: CameraBounds): MapPoint {
  const scale = pixelsPerUnit(camera, viewport, bounds);
  return {
    x: (point.x - camera.centerX) * scale + viewport.width / 2,
    y: (point.y - camera.centerY) * scale + viewport.height / 2
  };
}

export function screenToMap(point: MapPoint, camera: Camera, viewport: Viewport, bounds: CameraBounds): MapPoint {
  const scale = pixelsPerUnit(camera, viewport, bounds);
  return {
    x: (point.x - viewport.width / 2) / scale + camera.centerX,
    y: (point.y - viewport.height / 2) / scale + camera.centerY
  };
}

export function panCamera(camera: Camera, deltaX: number, deltaY: number, viewport: Viewport, bounds: CameraBounds): Camera {
  const scale = pixelsPerUnit(camera, viewport, bounds);
  return clampCamera({ ...camera, centerX: camera.centerX - deltaX / scale, centerY: camera.centerY - deltaY / scale }, bounds);
}

/** Zooms while keeping the map point under `focus` (screen pixels) fixed. */
export function zoomCameraAt(camera: Camera, zoom: number, focus: MapPoint, viewport: Viewport, bounds: CameraBounds): Camera {
  const anchor = screenToMap(focus, camera, viewport, bounds);
  const next = clampCamera({ ...camera, zoom }, bounds);
  const scale = pixelsPerUnit(next, viewport, bounds);
  return clampCamera({
    centerX: anchor.x - (focus.x - viewport.width / 2) / scale,
    centerY: anchor.y - (focus.y - viewport.height / 2) / scale,
    zoom: next.zoom
  }, bounds);
}

export function semanticLevel(zoom: number): SemanticLevel {
  if (zoom >= 2.1) return "detail";
  if (zoom >= 1.45) return "operational";
  return "overview";
}
