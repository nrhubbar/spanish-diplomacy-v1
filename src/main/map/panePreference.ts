import type { PaneLayout } from "./MapPane";

/** Whether the player opened or closed each layout's pane; a layout left out follows its default. */
export type PaneOpen = Readonly<Partial<Record<PaneLayout, boolean>>>;

/** The player's own pane choices, kept in this browser. A convenience: without storage the defaults stand. */
export interface PanePreference {
  readonly open: PaneOpen;
  readonly width?: number;
}

const storageKey = "spanish-diplomacy.pane";

function fieldsOf(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function loadPanePreference(): PanePreference {
  try {
    const { open, width } = fieldsOf(JSON.parse(localStorage.getItem(storageKey) ?? "{}"));
    const { sheet, side } = fieldsOf(open);
    return {
      open: { ...(typeof sheet === "boolean" ? { sheet } : {}), ...(typeof side === "boolean" ? { side } : {}) },
      ...(typeof width === "number" && Number.isFinite(width) ? { width } : {})
    };
  } catch {
    return { open: {} };
  }
}

/** Keeps whether one layout's pane is open, with the other choices. */
export function savePaneOpen(layout: PaneLayout, open: boolean): void {
  const kept = loadPanePreference();
  save({ ...kept, open: { ...kept.open, [layout]: open } });
}

/** Keeps the side pane's width with the other choices; `undefined` forgets it. */
export function savePaneWidth(width: number | undefined): void {
  const { open } = loadPanePreference();
  save({ open, ...(width === undefined ? {} : { width }) });
}

function save(preference: PanePreference): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(preference));
  } catch {
    // The choice lasts until the page closes.
  }
}
