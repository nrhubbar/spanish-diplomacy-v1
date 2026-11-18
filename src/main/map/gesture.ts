import type { MapPoint } from "../scenarios/loader";
import { type Camera, type CameraBounds, clampCamera, pixelsPerUnit, type Viewport, zoomCameraAt } from "./camera";

/**
 * Pointer gestures as a pure state machine: one pointer drags, two pointers pinch. The hook
 * feeds DOM pointer events in and applies the returned camera.
 */
export interface GestureState {
  readonly moved: boolean;
  readonly pointers: ReadonlyMap<number, MapPoint>;
  readonly start?: { readonly camera: Camera; readonly pointers: ReadonlyMap<number, MapPoint> };
}

export const idleGesture: GestureState = { moved: false, pointers: new Map() };

/** Pixels a pointer must travel before a press becomes a drag instead of a click. */
export const dragThreshold = 4;

export function pointerDown(state: GestureState, id: number, point: MapPoint, camera: Camera): GestureState {
  const pointers = new Map(state.pointers).set(id, point);
  return { moved: pointers.size > 1, pointers, start: { camera, pointers } };
}

export function pointerMove(
  state: GestureState,
  id: number,
  point: MapPoint,
  viewport: Viewport,
  bounds: CameraBounds
): { readonly camera?: Camera; readonly state: GestureState } {
  if (!state.pointers.has(id) || state.start === undefined) return { state };
  const pointers = new Map(state.pointers).set(id, point);
  const { start } = state;

  const now = twoPointers(pointers);
  const then = twoPointers(start.pointers);
  if (now !== undefined && then !== undefined) {
    const [a, b] = now;
    const [startA, startB] = then;
    const startDistance = Math.max(1, distance(startA, startB));
    const center = midpoint(startA, startB);
    const camera = zoomCameraAt(start.camera, start.camera.zoom * (distance(a, b) / startDistance), center, viewport, bounds);
    return { camera, state: { moved: true, pointers, start } };
  }

  const origin = start.pointers.get(id);
  if (origin === undefined) return { state: { ...state, pointers } };
  const deltaX = point.x - origin.x;
  const deltaY = point.y - origin.y;
  const moved = state.moved || Math.hypot(deltaX, deltaY) > dragThreshold;
  if (!moved) return { state: { ...state, pointers } };
  const scale = pixelsPerUnit(start.camera, viewport, bounds);
  const camera = clampCamera({
    ...start.camera,
    centerX: start.camera.centerX - deltaX / scale,
    centerY: start.camera.centerY - deltaY / scale
  }, bounds);
  return { camera, state: { moved: true, pointers, start } };
}

export function pointerUp(state: GestureState, id: number, camera: Camera): GestureState {
  const pointers = new Map(state.pointers);
  pointers.delete(id);
  return pointers.size === 0
    ? { moved: state.moved, pointers }
    : { moved: state.moved, pointers, start: { camera, pointers } };
}

function twoPointers(pointers: ReadonlyMap<number, MapPoint>): readonly [MapPoint, MapPoint] | undefined {
  const [a, b] = pointers.values();
  return a === undefined || b === undefined ? undefined : [a, b];
}

function distance(a: MapPoint, b: MapPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: MapPoint, b: MapPoint): MapPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
