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
import {
  advancePan,
  classifyKeyTarget,
  idlePan,
  isPanning,
  mapKeyIntent,
  panKeyDown,
  panKeyUp,
  type PanState,
  shouldHandleMapKey
} from "./keyboard";

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

/** The physical key, so Shift or a layout change between keydown and keyup cannot strand it. */
function keyCode(event: { readonly code: string; readonly key: string }): string {
  return event.code === "" ? event.key.toLowerCase() : event.code;
}

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
  const pan = useRef<PanState>(idlePan);
  const panFrame = useRef<number | undefined>(undefined);
  const panGeometry = useRef({ bounds, viewport });

  useEffect(() => {
    panGeometry.current = { bounds, viewport };
  }, [bounds, viewport]);

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

  // K1: the only impure part of keyboard panning. A frame loop runs only while a pan key is
  // held or a tap is gliding; the motion itself is the pure `advancePan`.
  const stopPan = useCallback(() => {
    pan.current = idlePan;
    if (panFrame.current !== undefined) cancelAnimationFrame(panFrame.current);
    panFrame.current = undefined;
  }, []);

  const startPan = useCallback(() => {
    if (panFrame.current !== undefined) return;
    let last = performance.now();
    const frame = (now: number): void => {
      const step = advancePan(pan.current, now - last);
      last = now;
      pan.current = step.state;
      if (step.deltaX !== 0 || step.deltaY !== 0) {
        const { bounds: currentBounds, viewport: currentViewport } = panGeometry.current;
        setCamera((current) => panCamera(current, step.deltaX, step.deltaY, currentViewport, currentBounds));
      }
      panFrame.current = isPanning(pan.current) ? requestAnimationFrame(frame) : undefined;
    };
    panFrame.current = requestAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const release = (event: globalThis.KeyboardEvent): void => {
      pan.current = panKeyUp(pan.current, keyCode(event));
    };
    const hidden = (): void => {
      if (document.hidden) stopPan();
    };
    // Keyup is heard on the window, so a key released after focus left the map still stops.
    window.addEventListener("keyup", release);
    window.addEventListener("blur", stopPan);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("keyup", release);
      window.removeEventListener("blur", stopPan);
      document.removeEventListener("visibilitychange", hidden);
      stopPan();
    };
  }, [stopPan]);

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
    // A pan chord such as Cmd+D is a browser shortcut, and macOS sends no keyup for its key
    // while Cmd is down, so it would pan until the window lost focus.
    if (intent.kind === "pan" && (event.metaKey || event.ctrlKey || event.altKey)) return;
    event.preventDefault();
    switch (intent.kind) {
      case "select":
        onSelect(event.target);
        return;
      case "pan":
        // Auto-repeat is ignored: a held key already pans continuously.
        if (event.repeat) return;
        pan.current = panKeyDown(pan.current, keyCode(event), intent.direction);
        startPan();
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
  }, [onSelect, zoomBy, reset, startPan]);

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
