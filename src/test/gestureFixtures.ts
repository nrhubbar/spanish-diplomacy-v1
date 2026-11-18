import type { CameraBounds } from "../main/map/camera";
import { idleGesture, pointerDown, pointerMove, pointerUp } from "../main/map/gesture";

/** Exercises gesture edge paths: a pointer that is tracked but missing from the start snapshot. */
export function gestureFixtures(): boolean {
  const bounds: CameraBounds = { content: { height: 100, width: 100, x: 0, y: 0 }, focus: { height: 100, width: 100, x: 0, y: 0 } };
  const viewport = { height: 100, insetBottom: 0, insetRight: 0, width: 100 };
  const camera = { centerX: 50, centerY: 50, zoom: 1 };
  const pressed = pointerDown(idleGesture, 1, { x: 0, y: 0 }, camera);
  const orphan = { ...pressed, pointers: new Map(pressed.pointers).set(2, { x: 5, y: 5 }) };
  const moved = pointerMove({ ...orphan, start: { camera, pointers: new Map([[1, { x: 0, y: 0 }]]) } }, 2, { x: 9, y: 9 }, viewport, bounds);
  const released = pointerUp(moved.state, 2, camera);
  return moved.camera === undefined && released.pointers.size === 1;
}
