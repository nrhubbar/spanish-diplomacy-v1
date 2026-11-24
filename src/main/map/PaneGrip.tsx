import { type JSX, type PointerEvent, useRef } from "react";
import { clampPaneWidth, paneKey, paneLimits, sheetKey, sheetPercent, type SheetStop, stopFor, tappedStop } from "./paneSize";

interface PaneGripProps {
  readonly mapWidth: number;
  /** The width chosen, once the drag ends or a key is pressed; undefined goes back to the default. */
  readonly onWidth: (width: number | undefined) => void;
  readonly paneId: string;
  readonly width: number;
}

/** The handle on the side pane's left edge: drag it, or use the arrow keys, Home, End and Enter. */
export function PaneGrip({ mapWidth, onWidth, paneId, width }: PaneGripProps): JSX.Element {
  const drag = useRef<{ readonly from: number; width: number } | undefined>(undefined);
  const limits = paneLimits(mapWidth);
  // Only the pane follows the pointer; the map is told the width once, when the drag ends.
  const draw = (grip: Element, drawn: number): void => {
    grip.closest<HTMLElement>(".campaign-map")?.style.setProperty("--pane-width", `${String(drawn)}px`);
  };
  const end = (): void => {
    if (drag.current === undefined) return;
    const chosen = drag.current.width;
    drag.current = undefined;
    if (chosen !== width) onWidth(chosen);
  };
  /** The gesture was taken away (cancelled, or its capture lost): the pane goes back to the map's width. */
  const revert = (event: PointerEvent<HTMLDivElement>): void => {
    if (drag.current === undefined) return;
    drag.current = undefined;
    draw(event.currentTarget, width);
  };
  return (
    <div
      aria-controls={paneId}
      aria-label="Pane width"
      aria-orientation="vertical"
      aria-valuemax={limits.max}
      aria-valuemin={limits.min}
      aria-valuenow={width}
      aria-valuetext={`${String(width)} pixels`}
      className="map-pane-grip"
      onDoubleClick={() => { onWidth(undefined); }}
      onKeyDown={(event) => {
        const next = paneKey(event.key, width, mapWidth);
        if (next === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        onWidth(next === "reset" ? undefined : next);
      }}
      onLostPointerCapture={revert}
      onPointerCancel={revert}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { from: event.clientX, width };
      }}
      onPointerMove={(event) => {
        if (drag.current === undefined) return;
        drag.current.width = clampPaneWidth(width + drag.current.from - event.clientX, mapWidth);
        draw(event.currentTarget, drag.current.width);
      }}
      onPointerUp={end}
      role="separator"
      tabIndex={0}
    />
  );
}

const stopNames: Readonly<Record<SheetStop, string>> = { bar: "Bar", half: "Half", tall: "Tall" };

interface SheetGripProps {
  readonly onStop: (stop: SheetStop) => void;
  readonly paneId: string;
  readonly stop: SheetStop;
}

/** The handle on top of the phone's sheet: drag or swipe it to a stop, tap it, or use the arrow keys. */
export function SheetGrip({ onStop, paneId, stop }: SheetGripProps): JSX.Element {
  const from = useRef<number | undefined>(undefined);
  const forget = (): void => { from.current = undefined; };
  const release = (event: PointerEvent<HTMLDivElement>): void => {
    const start = from.current;
    forget();
    if (start === undefined) return;
    if (Math.abs(event.clientY - start) < 8) {
      onStop(tappedStop(stop));
      return;
    }
    const map = event.currentTarget.closest(".campaign-map")?.getBoundingClientRect();
    if (map !== undefined && map.height > 0) onStop(stopFor((map.bottom - event.clientY) / map.height));
  };
  return (
    <div
      aria-controls={paneId}
      aria-label="Pane height"
      aria-orientation="horizontal"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={sheetPercent[stop]}
      aria-valuetext={stopNames[stop]}
      className="map-sheet-grip"
      onKeyDown={(event) => {
        const next = sheetKey(event.key, stop);
        if (next === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        onStop(next);
      }}
      onLostPointerCapture={forget}
      onPointerCancel={forget}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        from.current = event.clientY;
      }}
      onPointerUp={release}
      role="separator"
      tabIndex={0}
    />
  );
}
