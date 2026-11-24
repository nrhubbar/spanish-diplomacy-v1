import { type JSX, type ReactNode, useId } from "react";
import { PaneGrip, SheetGrip } from "./PaneGrip";
import type { SheetStop } from "./paneSize";

export interface PaneContent {
  /** When this changes, a collapsed pane opens so the player sees the response. */
  readonly attentionKey?: string;
  /** U3: the back link above the title, naming the view it returns to. */
  readonly back?: { readonly label: string; readonly onBack: () => void };
  /** U1: on a phone, the action that rides in the sheet's bar (End Turn), whatever the body is. */
  readonly barAction?: ReactNode;
  readonly body: ReactNode;
  /**
   * Set for reading content with no controls of its own: the body becomes a tab stop so a
   * keyboard user can scroll it.
   */
  readonly bodyFocusable?: boolean;
  readonly footer?: ReactNode;
  /**
   * On narrow screens, while defined, the sheet collapses to a bar showing this content so
   * the map stays visible (for example while choosing a destination).
   */
  readonly sheetFocus?: ReactNode;
  /** On a phone the sheet opens tall: a long list to work through (Invade, Reinforce, Recruit). */
  readonly tall?: boolean;
  readonly title: string;
}

interface MapPaneProps {
  readonly content: PaneContent;
  readonly layout: PaneLayout;
  readonly mapWidth: number;
  readonly onStop: (stop: SheetStop) => void;
  readonly onToggle: () => void;
  readonly onWidth: (width: number | undefined) => void;
  readonly open: boolean;
  /** Where the phone's sheet stands. */
  readonly stop: SheetStop;
  readonly width: number;
}

export type PaneLayout = "side" | "sheet";

/** Below this map width the pane becomes a bottom sheet instead of a side panel. */
const sheetBreakpoint = 720;

/** Height of the collapsed mobile sheet bar, kept clear by the camera framing. */
export const sheetBarHeight = 64;

export function paneLayoutFor(mapWidth: number): PaneLayout {
  return mapWidth < sheetBreakpoint ? "sheet" : "side";
}

/**
 * Translucent, collapsible details pane that lives inside the map. The map stays visible
 * behind it, and collapsing it gives the map back; its left edge drags to resize it. On narrow
 * screens it is a bottom sheet with three stops, whose collapsed bar keeps the primary action within reach.
 */
export function MapPane({ content, layout, mapWidth, onStop, onToggle, onWidth, open, stop, width }: MapPaneProps): JSX.Element {
  const bodyId = useId();
  const collapsedSheet = layout === "sheet" && !open;
  // U1: on a phone the bar keeps its action (End Turn) open or closed; without one, a collapsed bar shows the footer.
  const barAction = layout !== "sheet" || content.sheetFocus !== undefined ? undefined : content.barAction ?? (open ? undefined : content.footer);
  return (
    <aside aria-label={content.title} className="map-pane" data-layout={layout} data-map-control="" data-open={open} {...(layout === "sheet" ? { "data-stop": stop } : {})}>
      {layout === "side"
        ? open ? <PaneGrip mapWidth={mapWidth} onWidth={onWidth} paneId={bodyId} width={width} /> : null
        : content.sheetFocus === undefined ? <SheetGrip onStop={onStop} paneId={bodyId} stop={stop} /> : null}
      <div className="map-pane-header">
        {open ? (
          <div className="map-pane-heading">
            {content.back === undefined ? null : (
              <button className="map-pane-back" onClick={content.back.onBack} type="button">
                <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>
                {content.back.label}
              </button>
            )}
            <h2 className="map-pane-title">{content.title}</h2>
          </div>
        ) : null}
        <button
          aria-controls={bodyId}
          aria-expanded={open}
          className="map-pane-toggle"
          onClick={onToggle}
          type="button"
        >
          <span aria-hidden="true" className="map-pane-toggle-icon" />
          <span className="map-pane-toggle-label">{open ? `Hide ${content.title.charAt(0).toLowerCase()}${content.title.slice(1)}` : content.title}</span>
        </button>
        {collapsedSheet && content.sheetFocus !== undefined ? <div className="map-pane-bar-focus" role="status">{content.sheetFocus}</div> : null}
        {barAction === undefined ? null : <div className="map-pane-bar-action">{barAction}</div>}
      </div>
      <div className="map-pane-panel" hidden={!open} id={bodyId}>
        <div className="map-pane-body" {...(content.bodyFocusable === true ? { tabIndex: 0 } : {})}>{content.body}</div>
        {content.footer === undefined ? null : <div className="map-pane-footer">{content.footer}</div>}
      </div>
    </aside>
  );
}
