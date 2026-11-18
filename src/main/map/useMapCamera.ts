import { type KeyboardEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  type Camera,
  type CameraBounds,
  cameraLimits,
  initialCamera,
  panCamera,
  type Viewport,
  type ViewportInsets,
  zoomCameraAt
} from "./camera";
import { idleGesture, pointerDown, pointerMove, pointerUp } from "./gesture";
import { classifyKeyTarget, mapKeyIntent, shouldHandleMapKey } from "./keyboard";

export interface MapCameraControls {
  readonly camera: Camera;
  /** True right after a drag, so the click that ends a drag does not select a territory. */
  readonly consumeDrag: () => boolean;
  readonly containerRef: (element: HTMLDivElement | null) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  readonly onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
  readonly onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  readonly onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  readonly onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  readonly reset: () => void;
  /** False until the container has been measured; layers render only once it is true. */
  readonly measured: boolean;
  readonly viewport: Viewport;
  readonly zoomBy: (delta: number) => void;
}

const unmeasured: Viewport = { height: 0, insetBottom: 0, insetRight: 0, width: 0 };

/**
 * Owns the camera: measures the container, frames the focus area once, and turns wheel,
 * pointer, and keyboard input into camera changes through the pure camera/gesture modules.
 */
export function useMapCamera(
  bounds: CameraBounds,
  insetsFor: (width: number) => ViewportInsets,
  onSelect: (target: EventTarget | null) => void
): MapCameraControls {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>(unmeasured);
  const [camera, setCamera] = useState<Camera>(() => initialCamera(unmeasured, bounds));
  const gesture = useRef(idleGesture);
  const dragged = useRef(false);
  const framed = useRef(false);

  // Re-measures on resize and whenever the pane insets change; frames the map only once.
  useEffect(() => {
    if (element === null) return undefined;
    const measure = (): void => {
      const insets = insetsFor(element.clientWidth);
      const next: Viewport = { height: element.clientHeight, insetBottom: insets.bottom, insetRight: insets.right, width: element.clientWidth };
      setViewport((current) =>
        current.width === next.width && current.height === next.height
          && current.insetRight === next.insetRight && current.insetBottom === next.insetBottom ? current : next);
      if (!framed.current) {
        framed.current = true;
        setCamera(initialCamera(next, bounds));
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => { observer.disconnect(); };
  }, [element, bounds, insetsFor]);

  useEffect(() => {
    if (element === null) return undefined;
    const handleWheel = (event: globalThis.WheelEvent): void => {
      // Non-passive so the page never scrolls while the pointer is over the map.
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const focus = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      setCamera((current) => zoomCameraAt(current, current.zoom * Math.exp(-event.deltaY * 0.0022), focus, viewport, bounds));
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => { element.removeEventListener("wheel", handleWheel); };
  }, [element, viewport, bounds]);

  const local = useCallback((event: { readonly clientX: number; readonly clientY: number }) => {
    const rect = element?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  }, [element]);

  const zoomBy = useCallback((delta: number) => {
    const focus = { x: (viewport.width - viewport.insetRight) / 2, y: (viewport.height - viewport.insetBottom) / 2 };
    setCamera((current) => zoomCameraAt(current, current.zoom + delta, focus, viewport, bounds));
  }, [viewport, bounds]);

  const reset = useCallback(() => {
    setCamera(initialCamera(viewport, bounds));
  }, [viewport, bounds]);

  const consumeDrag = useCallback(() => {
    const wasDrag = dragged.current;
    dragged.current = false;
    return wasDrag;
  }, []);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const intent = mapKeyIntent(event.key);
    if (intent === undefined || !shouldHandleMapKey(intent, classifyKeyTarget(event.target))) return;
    event.preventDefault();
    switch (intent.kind) {
      case "select":
        onSelect(event.target);
        return;
      case "pan":
        setCamera((current) => panCamera(current, intent.deltaX, intent.deltaY, viewport, bounds));
        return;
      case "zoom-in":
        zoomBy(cameraLimits.zoomStep);
        return;
      case "zoom-out":
        zoomBy(-cameraLimits.zoomStep);
        return;
      case "reset":
        reset();
    }
  }, [viewport, bounds, onSelect, zoomBy, reset]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button > 0) return;
    if (event.target instanceof Element && event.target.closest("[data-map-control]") !== null) return;
    gesture.current = pointerDown(gesture.current, event.pointerId, local(event), camera);
  }, [camera, local]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const result = pointerMove(gesture.current, event.pointerId, local(event), viewport, bounds);
    if (result.state.moved && !gesture.current.moved) event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = result.state;
    if (result.camera !== undefined) setCamera(result.camera);
  }, [viewport, bounds, local]);

  const onPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    dragged.current = gesture.current.moved;
    gesture.current = pointerUp(gesture.current, event.pointerId, camera);
    if (gesture.current.pointers.size === 0) gesture.current = idleGesture;
  }, [camera]);

  const onPointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    gesture.current = pointerUp(gesture.current, event.pointerId, camera);
  }, [camera]);

  return {
    camera,
    consumeDrag,
    containerRef: setElement,
    onKeyDown,
    onPointerCancel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    measured: viewport.width > 0,
    reset,
    viewport,
    zoomBy
  };
}
