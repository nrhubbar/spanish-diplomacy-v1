import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SubTerritoryId, TerritoryId } from "../engine/types";
import { beginPlanning, endTurn, exitGame, startGame, startNextTurn } from "./gameSlice";
import { timeRanOut } from "./timeout";

/** The tabs of Territory Info (U9). Territory Info owns which ones it shows. */
export type TerritoryTab = "units" | "buildings" | "recruit" | "production";

/**
 * U3: every view the planning pane can show. This turn is the root; the others are pushed on
 * top of it and the pane's back link pops them.
 */
export type PaneView =
  | { readonly kind: "thisTurn" }
  | { readonly id: TerritoryId; readonly kind: "territory"; readonly tab?: TerritoryTab }
  | { readonly kind: "invade"; readonly target: TerritoryId }
  | { readonly kind: "reinforce"; readonly target: TerritoryId }
  | { readonly kind: "build"; readonly subTerritory?: SubTerritoryId; readonly territory: TerritoryId }
  | { readonly kind: "recruit"; readonly territory: TerritoryId }
  | { readonly kind: "recruitment" }
  | { readonly kind: "building" }
  | { readonly kind: "lastTurn" };

export type PaneViewKind = PaneView["kind"];

export interface PaneState {
  /** Never empty: the root is always This turn. The last entry is the view shown. */
  readonly stack: readonly PaneView[];
}

export const rootView: PaneView = { kind: "thisTurn" };

const initialState: PaneState = { stack: [rootView] };

/**
 * Pushes a view. A view of the same kind already in the stack is taken out first, so the stack
 * holds at most one of each kind (clicking around the map never builds a deep back trail), and
 * pushing the root returns to it.
 */
export function pushed(stack: readonly PaneView[], view: PaneView): readonly PaneView[] {
  if (view.kind === "thisTurn") return [rootView];
  return [...stack.filter((entry) => entry.kind !== view.kind), view];
}

/** The stack after the back link: the top view goes, and the root always stays. */
export function popped(stack: readonly PaneView[]): readonly PaneView[] {
  return stack.length <= 1 ? [rootView] : stack.slice(0, -1);
}

/** A view opened from the top bar: straight on top of This turn, so back returns there. */
export function opened(view: PaneView): readonly PaneView[] {
  return view.kind === "thisTurn" ? [rootView] : [rootView, view];
}

/** The view shown: the top of the stack. */
export function topView(stack: readonly PaneView[]): PaneView {
  return stack.at(-1) ?? rootView;
}

/** U3: the view a map click opens: Territory Info, unless the click picks a destination. */
export function viewForMapClick(choosingDestination: boolean, territoryId: TerritoryId): PaneView | undefined {
  return choosingDestination ? undefined : { id: territoryId, kind: "territory" };
}

/** A stable key for a view, so a newly shown view can open a collapsed pane. */
export function viewKey(view: PaneView): string {
  switch (view.kind) {
    case "territory":
      return `territory:${view.id}:${view.tab ?? ""}`;
    case "invade":
    case "reinforce":
      return `${view.kind}:${view.target}`;
    case "build":
      return `build:${view.territory}:${view.subTerritory ?? ""}`;
    case "recruit":
      return `recruit:${view.territory}`;
    default:
      return view.kind;
  }
}

/** One Redux slice owns the pane stack (U3). A new turn, or a new player at the screen, starts on This turn. */
export const paneSlice = createSlice({
  extraReducers: (builder) => {
    builder
      .addCase(startGame, () => initialState)
      .addCase(exitGame, () => initialState)
      .addCase(beginPlanning, () => initialState)
      .addCase(endTurn, () => initialState)
      .addCase(timeRanOut, () => initialState)
      .addCase(startNextTurn, () => initialState);
  },
  initialState,
  name: "pane",
  reducers: {
    /** Opens a view on top of This turn, as the top bar's buttons do. */
    openView: (_state, { payload }: PayloadAction<PaneView>) => ({ stack: opened(payload) }),
    popView: (state) => ({ stack: popped(state.stack) }),
    pushView: (state, { payload }: PayloadAction<PaneView>) => ({ stack: pushed(state.stack, payload) }),
    resetPane: () => initialState
  }
});

export const { openView, popView, pushView, resetPane } = paneSlice.actions;
