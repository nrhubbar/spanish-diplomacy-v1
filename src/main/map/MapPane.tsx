import { type JSX, type ReactNode, useId } from "react";

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
  readonly title: string;
}

interface MapPaneProps {
  readonly content: PaneContent;
  readonly layout: PaneLayout;
  readonly onToggle: () => void;
  readonly open: boolean;
}

export type PaneLayout = "side" | "sheet";

/** Below this map width the pane becomes a bottom sheet instead of a side panel. */
export const sheetBreakpoint = 720;

/** Height of the collapsed mobile sheet bar, kept clear by the camera framing. */
export const sheetBarHeight = 64;

export function paneLayoutFor(mapWidth: number): PaneLayout {
  return mapWidth < sheetBreakpoint ? "sheet" : "side";
}

/** Side pane width in pixels; mirrored into CSS through `--pane-width`. */
export function paneWidthFor(mapWidth: number): number {
  return Math.round(Math.min(416, Math.max(300, mapWidth * 0.3)));
}

/**
 * Translucent, collapsible details pane that lives inside the map. The map stays visible
 * behind it, and collapsing it gives the map back. On narrow screens it is a bottom sheet
 * whose collapsed bar keeps the primary action within reach.
 */
export function MapPane({ content, layout, onToggle, open }: MapPaneProps): JSX.Element {
  const bodyId = useId();
  const collapsedSheet = layout === "sheet" && !open;
  // U1: on a phone the bar keeps its action (End Turn) open or closed; without one, a collapsed bar shows the footer.
  const barAction = layout !== "sheet" || content.sheetFocus !== undefined ? undefined : content.barAction ?? (open ? undefined : content.footer);
  return (
    <aside aria-label={content.title} className="map-pane" data-layout={layout} data-map-control="" data-open={open}>
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
          <span>{open ? `Hide ${content.title.charAt(0).toLowerCase()}${content.title.slice(1)}` : content.title}</span>
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
