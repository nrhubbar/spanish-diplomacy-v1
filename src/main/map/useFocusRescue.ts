import { type FocusEvent, useCallback, useLayoutEffect, useRef } from "react";
import type { TerritoryId } from "../engine/types";

interface LastFocus {
  readonly surface: HTMLElement;
  readonly target: Element;
}

/**
 * Keeps keyboard focus on the map when a re-render removes the element that held it, as when
 * Enter on a summed counter opens its territory into single armies. Focus moves to that
 * territory's region, or else to the map itself, instead of falling to the page body.
 *
 * Returns the focus and blur handlers for the map surface.
 */
export function useFocusRescue(expandedTerritoryId: TerritoryId | undefined): {
  readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
  readonly onFocus: (event: FocusEvent<HTMLElement>) => void;
} {
  const last = useRef<LastFocus | null>(null);

  useLayoutEffect(() => {
    const entry = last.current;
    if (entry === null || entry.target.isConnected || !entry.surface.isConnected) return;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    const region = expandedTerritoryId === undefined
      ? null
      : entry.surface.querySelector(`.map-region[data-territory-id="${expandedTerritoryId}"]`);
    const next = region instanceof SVGElement || region instanceof HTMLElement ? region : entry.surface;
    next.focus({ preventScroll: true });
  });

  const onFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    last.current = { surface: event.currentTarget, target: event.target };
  }, []);
  // Focus that leaves for another control on the page is the player's choice; forget the map.
  const onBlur = useCallback((event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && !event.currentTarget.contains(next)) last.current = null;
  }, []);
  return { onBlur, onFocus };
}
