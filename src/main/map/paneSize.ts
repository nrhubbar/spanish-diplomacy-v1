/** The map pane's size: its width beside the map, and the phone sheet's three stops. */

const minWidth = 300;
const maxWidth = 640;
/** Map kept clear beside the pane (720 px), and the pane's own margin. */
const clearOfPane = 732;
const keyStep = 16;

export interface PaneLimits {
  readonly max: number;
  readonly min: number;
}

/** The narrowest and widest pane for a map of this width. On a small map the minimum wins. */
export function paneLimits(mapWidth: number): PaneLimits {
  return { max: Math.max(minWidth, Math.min(maxWidth, Math.floor(mapWidth - clearOfPane))), min: minWidth };
}

export function clampPaneWidth(width: number, mapWidth: number): number {
  const { max, min } = paneLimits(mapWidth);
  return Math.round(Math.min(max, Math.max(min, width)));
}

/** The pane's width until the player chooses one; mirrored into CSS through `--pane-width`. */
export function paneWidthFor(mapWidth: number): number {
  return Math.round(Math.min(416, Math.max(minWidth, mapWidth * 0.3)));
}

/** What a key on the grip does: a new width, "reset", or nothing. The grip is on the pane's left, so Left widens it. */
export function paneKey(key: string, width: number, mapWidth: number): number | "reset" | undefined {
  const { max, min } = paneLimits(mapWidth);
  switch (key) {
    case "ArrowLeft":
      return clampPaneWidth(width + keyStep, mapWidth);
    case "ArrowRight":
      return clampPaneWidth(width - keyStep, mapWidth);
    case "Home":
      return min;
    case "End":
      return max;
    case "Enter":
      return "reset";
    default:
      return undefined;
  }
}

/** Where the phone sheet stands: its bar alone, 46% of the map, or 86%. */
export const sheetStops = ["bar", "half", "tall"] as const;
export type SheetStop = (typeof sheetStops)[number];

/** Each stop's share of the map's height, in percent (the CSS heights match). */
export const sheetPercent: Readonly<Record<SheetStop, number>> = { bar: 0, half: 46, tall: 86 };

/** The stop nearest to a sheet let go at this share of the map's height. */
export function stopFor(share: number): SheetStop {
  if (share < 0.25) return "bar";
  return share < 0.66 ? "half" : "tall";
}

/** A tap on the grip: between half and tall, and from the bar to half. */
export function tappedStop(stop: SheetStop): SheetStop {
  return stop === "half" ? "tall" : "half";
}

/** What a key on the sheet's grip does. */
export function sheetKey(key: string, stop: SheetStop): SheetStop | undefined {
  const at = sheetStops.indexOf(stop);
  switch (key) {
    case "ArrowUp":
      return sheetStops[Math.min(at + 1, 2)];
    case "ArrowDown":
      return sheetStops[Math.max(at - 1, 0)];
    case "Home":
      return "bar";
    case "End":
      return "tall";
    case "Enter":
    case " ":
      return tappedStop(stop);
    default:
      return undefined;
  }
}
