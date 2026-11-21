import { type ReactNode, useCallback, useState } from "react";
import { type PaneContent, type PaneLayout, paneLayoutFor, paneWidthFor, sheetBarHeight } from "./MapPane";

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
  readonly toggleBriefing: (open: boolean) => void;
  readonly togglePane: (open: boolean) => void;
}

export const briefingTitle = "Briefing";

/**
 * Which view the in-map pane shows and whether it is open.
 *
 * - The pane follows its layout default (open beside the map, collapsed as a sheet) until the
 *   player chooses.
 * - A new selection or message (the attention key) opens the pane on the screen's content.
 * - The Briefing replaces that content while shown and keeps the screen's footer and phone bar
 *   action, so the primary action stays in reach. Collapsing the pane closes the Briefing.
 */
export function usePaneView(pane: PaneContent | undefined, briefing: MapBriefing | undefined): PaneView {
  const openOnStart = briefing?.openOnStart === true;
  // undefined = follow the layout default: open as a side pane, collapsed as a mobile sheet.
  const [choice, setChoice] = useState<boolean | undefined>(openOnStart ? true : undefined);
  const [briefingChosen, setBriefingChosen] = useState(openOnStart);
  const attention = pane?.attentionKey;
  const [seenAttention, setSeenAttention] = useState(attention);
  if (attention !== seenAttention) {
    setSeenAttention(attention);
    if (attention !== undefined) {
      setBriefingChosen(false);
      if (choice !== true) setChoice(true);
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
  const insetsFor = useCallback((width: number) => {
    const layout = paneLayoutFor(width);
    if (!hasPane) return { bottom: 0, right: 0 };
    return layout === "side"
      ? { bottom: 0, right: (choice ?? true) ? paneWidthFor(width) : 0 }
      : { bottom: sheetBarHeight, right: 0 };
  }, [choice, hasPane]);

  return {
    briefingShown,
    content,
    insetsFor,
    isOpen: (layout) => !(layout === "sheet" && content?.sheetFocus !== undefined) && (choice ?? layout === "side"),
    toggleBriefing: (open) => {
      const showing = briefingShown && open;
      setBriefingChosen(!showing);
      if (!showing) setChoice(true);
    },
    togglePane: (open) => {
      setChoice(!open);
      if (open) setBriefingChosen(false);
    }
  };
}
