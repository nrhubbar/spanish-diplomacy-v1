import { type ReactNode, useCallback, useState } from "react";
import { type PaneContent, type PaneLayout, paneLayoutFor, sheetBarHeight } from "./MapPane";
import { loadPanePreference, type PaneOpen, savePaneOpen, savePaneWidth } from "./panePreference";
import { clampPaneWidth, paneWidthFor, type SheetStop } from "./paneSize";

/** A Briefing the in-map pane can switch to, in place of the screen's own content. */
export interface MapBriefing {
  readonly body: ReactNode;
  /** Show the Briefing, with the pane open, when the map first appears. */
  readonly openOnStart: boolean;
}

export interface PaneView {
  readonly briefingShown: boolean;
  /** What the pane shows now: the Briefing or the screen's content. */
  readonly content: PaneContent | undefined;
  /** Camera insets for a map of this width, so framing leaves room for the pane. */
  readonly insetsFor: (width: number) => { readonly bottom: number; readonly right: number };
  readonly isOpen: (layout: PaneLayout) => boolean;
  /** The player dragged the phone's sheet to a stop. */
  readonly setStop: (stop: SheetStop) => void;
  /** The player chose a width for the side pane; undefined goes back to the default. */
  readonly setWidth: (width: number | undefined) => void;
  readonly stopIn: (layout: PaneLayout) => SheetStop;
  readonly toggleBriefing: (open: boolean) => void;
  /** The player closes the pane of this layout when it is open, and opens it when it is not. */
  readonly togglePane: (layout: PaneLayout, open: boolean) => void;
  /** The side pane's width for a map of this width: the player's own within the limits, else the default. */
  readonly widthFor: (mapWidth: number) => number;
}

const briefingTitle = "Briefing";

/** What the game opens is open in either layout, and is never kept as the player's choice. */
const openInBoth: PaneOpen = { sheet: true, side: true };

/**
 * Which view the in-map pane shows and whether it is open.
 *
 * - The pane follows its layout default (open beside the map, collapsed as a sheet) until the
 *   player chooses. That choice, one for each layout, and the width are kept in this browser.
 * - A new selection or message (the attention key) opens the pane on the screen's content.
 * - The Briefing replaces that content while shown and keeps the screen's footer and phone bar
 *   action, so the primary action stays in reach. Collapsing the pane closes the Briefing.
 */
export function usePaneView(pane: PaneContent | undefined, briefing: MapBriefing | undefined): PaneView {
  const openOnStart = briefing?.openOnStart === true;
  // A layout left out follows its default: open as a side pane, collapsed as a mobile sheet.
  const [choices, setChoices] = useState<PaneOpen>(() => (openOnStart ? openInBoth : loadPanePreference().open));
  const [width, setWidth] = useState(() => loadPanePreference().width);
  // undefined = as the view asks: tall for long lists, else half.
  const [tall, setTall] = useState<boolean | undefined>(undefined);
  const [briefingChosen, setBriefingChosen] = useState(openOnStart);
  const attention = pane?.attentionKey;
  const [seenAttention, setSeenAttention] = useState(attention);
  if (attention !== seenAttention) {
    setSeenAttention(attention);
    setTall(undefined);
    if (attention !== undefined) {
      setBriefingChosen(false);
      setChoices(openInBoth);
    }
  }

  const briefingShown = briefingChosen && briefing !== undefined;
  const content = briefingShown
    ? {
        body: briefing.body,
        bodyFocusable: true,
        title: briefingTitle,
        ...(pane?.footer === undefined ? {} : { footer: pane.footer }),
        ...(pane?.barAction === undefined ? {} : { barAction: pane.barAction })
      }
    : pane;
  const hasPane = content !== undefined;
  const widthFor = useCallback((mapWidth: number) => (width === undefined ? paneWidthFor(mapWidth) : clampPaneWidth(width, mapWidth)), [width]);
  const insetsFor = useCallback((mapWidth: number) => {
    const layout = paneLayoutFor(mapWidth);
    if (!hasPane) return { bottom: 0, right: 0 };
    return layout === "side"
      ? { bottom: 0, right: (choices.side ?? true) ? widthFor(mapWidth) : 0 }
      : { bottom: sheetBarHeight, right: 0 };
  }, [choices.side, hasPane, widthFor]);
  const isOpen = (layout: PaneLayout): boolean => !(layout === "sheet" && content?.sheetFocus !== undefined) && (choices[layout] ?? layout === "side");
  const togglePane = (layout: PaneLayout, open: boolean): void => {
    setChoices({ ...choices, [layout]: !open });
    savePaneOpen(layout, !open);
    if (open) setBriefingChosen(false);
  };

  return {
    briefingShown,
    content,
    insetsFor,
    isOpen,
    setStop: (stop) => {
      if (stop !== "bar") setTall(stop === "tall");
      const open = isOpen("sheet");
      if (open === (stop === "bar")) togglePane("sheet", open);
    },
    setWidth: (chosen) => {
      setWidth(chosen);
      savePaneWidth(chosen);
    },
    stopIn: (layout) => {
      if (!isOpen(layout)) return "bar";
      return tall ?? content?.tall === true ? "tall" : "half";
    },
    toggleBriefing: (open) => {
      const showing = briefingShown && open;
      setBriefingChosen(!showing);
      if (!showing) setChoices(openInBoth);
    },
    togglePane,
    widthFor
  };
}
