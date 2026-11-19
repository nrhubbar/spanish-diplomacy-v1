import type { JSX } from "react";
import { glyphs } from "../presentation/glyphs";
import { cameraLimits } from "./camera";
import type { PaneLayout } from "./MapPane";
import type { ScreenRect } from "./placement";

/**
 * Screen areas the fixed controls cover, so counters lay out around them (V4). Beside a side
 * pane the Briefing button stacks under the zoom group and the legend sits bottom left; with a
 * bottom sheet the button sits beside the zoom group and the legend follows it along the top, so
 * nothing covers the land. Reserved on every map screen, so counters keep their places when the
 * Briefing button is absent.
 */
export function mapControlObstacles(layout: PaneLayout, mapHeight: number): readonly ScreenRect[] {
  return layout === "side"
    ? [{ height: 184, width: 58, x: 0, y: 0 }, { height: 46, width: 120, x: 0, y: mapHeight - 46 }]
    : [{ height: 132, width: 108, x: 0, y: 0 }, { height: 48, width: 130, x: 108, y: 0 }];
}

interface MapControlsProps {
  /** Present when the screen has a Briefing to show. */
  readonly briefing?: { readonly onToggle: () => void; readonly shown: boolean };
  readonly onReset: () => void;
  readonly onZoom: (step: number) => void;
  readonly zoom: number;
}

/** Zoom buttons, the reset readout, and the "i" Briefing toggle beneath them. */
export function MapControls({ briefing, onReset, onZoom, zoom }: MapControlsProps): JSX.Element {
  const percent = String(Math.round(zoom * 100));
  return (
    <div className="map-controls" data-map-control="">
      <div className="map-zoom" role="group" aria-label="Zoom">
        <button aria-label="Zoom in" disabled={zoom >= cameraLimits.maxZoom} onClick={() => { onZoom(cameraLimits.zoomStep); }} type="button">+</button>
        <button aria-label={`${percent}%, reset map view`} className="map-zoom-level" onClick={onReset} type="button">{`${percent}%`}</button>
        <button aria-label="Zoom out" disabled={zoom <= cameraLimits.minZoom} onClick={() => { onZoom(-cameraLimits.zoomStep); }} type="button">{glyphs.minus}</button>
      </div>
      {briefing === undefined ? null : (
        <button
          aria-label="Briefing"
          aria-pressed={briefing.shown}
          className="map-briefing-toggle"
          onClick={briefing.onToggle}
          title="Briefing"
          type="button"
        >
          <span aria-hidden="true">i</span>
        </button>
      )}
      <span aria-live="polite" className="visually-hidden">{`Map zoom ${percent} percent`}</span>
    </div>
  );
}
