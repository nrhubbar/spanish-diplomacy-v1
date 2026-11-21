import { type MouseEvent, type PointerEvent, useCallback, useRef } from "react";
import type { TerritoryId } from "../engine/types";
import type { MapPoint } from "../scenarios/loader";
import { dragThreshold } from "./gesture";
import type { MapView, PointerInput } from "./view";

/** How long a finger rests on a territory before its quick actions open (U5). */
export const longPressMs = 500;

export interface TerritoryPress {
  /** True once after a long-press opened the actions, so the click that ends it selects nothing. */
  readonly consumeLongPress: () => boolean;
  /** How the last press was made: a mouse (or pen) or a finger. */
  readonly lastInput: () => PointerInput;
  readonly onContextMenu: (event: MouseEvent<HTMLDivElement>) => void;
  readonly onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  readonly onPointerEnd: () => void;
  readonly onPointerLeave: () => void;
  readonly onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
}

/**
 * U5, U7: map input beyond a click. A right-click on a territory, or a finger resting on it,
 * opens its quick actions (Android also sends a context menu on a long-press; whichever comes
 * first opens it, once). A drag cancels the long-press. The mouse over a territory is reported
 * for the reach card, only when it moves to another territory.
 */
export function useTerritoryPress(view: Pick<MapView, "onTerritoryHover" | "onTerritoryMenu">, territoryAt: (target: EventTarget | null) => TerritoryId | undefined): TerritoryPress {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef<MapPoint | undefined>(undefined);
  const opened = useRef(false);
  const input = useRef<PointerInput>("mouse");
  const hovered = useRef<TerritoryId | undefined>(undefined);
  const { onTerritoryHover, onTerritoryMenu } = view;

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    start.current = undefined;
  }, []);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    // A second finger (a pinch) cancels the long-press and starts none.
    const pinch = start.current !== undefined;
    cancel();
    if (pinch) return;
    opened.current = false;
    input.current = event.pointerType === "touch" ? "touch" : "mouse";
    const territoryId = territoryAt(event.target);
    if (input.current !== "touch" || territoryId === undefined || onTerritoryMenu === undefined) return;
    const at = { x: event.clientX, y: event.clientY };
    start.current = at;
    timer.current = setTimeout(() => {
      opened.current = true;
      start.current = undefined;
      onTerritoryMenu(territoryId, at, "touch");
    }, longPressMs);
  }, [cancel, onTerritoryMenu, territoryAt]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const from = start.current;
    if (from !== undefined && Math.hypot(event.clientX - from.x, event.clientY - from.y) > dragThreshold) cancel();
    if (event.pointerType !== "mouse" || onTerritoryHover === undefined) return;
    const territoryId = territoryAt(event.target);
    if (territoryId === hovered.current) return;
    hovered.current = territoryId;
    onTerritoryHover(territoryId, { x: event.clientX, y: event.clientY });
  }, [cancel, onTerritoryHover, territoryAt]);

  const onPointerLeave = useCallback(() => {
    cancel();
    if (hovered.current === undefined) return;
    hovered.current = undefined;
    onTerritoryHover?.(undefined, { x: 0, y: 0 });
  }, [cancel, onTerritoryHover]);

  const onContextMenu = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const territoryId = territoryAt(event.target);
    if (territoryId === undefined || onTerritoryMenu === undefined) return;
    event.preventDefault();
    const pending = start.current !== undefined;
    cancel();
    // A long-press that already opened the actions sends its own context menu too.
    if (opened.current) return;
    opened.current = pending;
    onTerritoryMenu(territoryId, { x: event.clientX, y: event.clientY }, input.current);
  }, [cancel, onTerritoryMenu, territoryAt]);

  const consumeLongPress = useCallback(() => {
    const was = opened.current;
    opened.current = false;
    return was;
  }, []);

  const lastInput = useCallback(() => input.current, []);

  return { consumeLongPress, lastInput, onContextMenu, onPointerDown, onPointerEnd: cancel, onPointerLeave, onPointerMove };
}
