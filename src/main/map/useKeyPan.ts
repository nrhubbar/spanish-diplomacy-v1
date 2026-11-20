import { type Dispatch, type RefObject, type SetStateAction, useCallback, useEffect, useRef } from "react";
import { type Camera, type CameraBounds, panCamera, type Viewport } from "./camera";
import { advancePan, idlePan, isPanning, panKeyUp, type PanState } from "./keyboard";

/** The physical key, so Shift or a layout change between keydown and keyup cannot strand it. */
export function keyCode(event: { readonly code: string; readonly key: string }): string {
  return event.code === "" ? event.key.toLowerCase() : event.code;
}

export interface KeyPan {
  /** The held pan keys; keydown handling updates it. */
  readonly panRef: RefObject<PanState>;
  /** Starts the frame loop if it is not running. */
  readonly startPan: () => void;
}

/** Keyboard panning for the map camera (K1), split from `useMapCamera` (H9). */
export function useKeyPan(setCamera: Dispatch<SetStateAction<Camera>>, bounds: CameraBounds, viewport: Viewport): KeyPan {
  const pan = useRef<PanState>(idlePan);
  const panFrame = useRef<number | undefined>(undefined);
  const panGeometry = useRef({ bounds, viewport });

  useEffect(() => {
    panGeometry.current = { bounds, viewport };
  }, [bounds, viewport]);

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
  }, [setCamera]);

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

  return { panRef: pan, startPan };
}
