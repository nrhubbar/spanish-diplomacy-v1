import type { RoadLevel } from "../../engine/types";
import type { Viewport } from "../camera";
import type { PaneLayout } from "../MapPane";
import type { ScreenRect } from "../placement";
import type { MapView } from "../view";

/**
 * U13 (Q-R2-8): the map's layers, the presets that switch several at once, the layers an order
 * in progress switches on by itself, and the zoom past which every sub-territory border shows.
 * The toolbar, the legend and the layers read these; nothing here touches the DOM.
 */

/** The layers the player can switch, in the More menu's order. */
export const layerIds = ["sub-territories", "rail", "roads", "order-lines", "battles"] as const;
export type LayerId = (typeof layerIds)[number];

export const layerLabels: Readonly<Record<LayerId, string>> = {
  battles: "Battles",
  "order-lines": "Order lines",
  rail: "Rail",
  roads: "Roads",
  "sub-territories": "Sub-territories"
};

export const presetIds = ["orders", "logistics", "economy"] as const;
export type PresetId = (typeof presetIds)[number];

interface Preset {
  readonly label: string;
  readonly layers: readonly LayerId[];
  /** What the preset shows, in a sentence, for the menu and the button's tooltip. */
  readonly note: string;
}

export const presets: Readonly<Record<PresetId, Preset>> = {
  economy: { label: "Economy", layers: ["sub-territories"], note: "Sub-territories and their towns; rail, roads, order lines and battles off." },
  logistics: { label: "Logistics", layers: ["sub-territories", "rail", "roads"], note: "Rail, roads and mountain passes; order lines and battles off." },
  orders: { label: "Orders", layers: ["sub-territories", "rail", "order-lines", "battles"], note: "Order lines, battles and the rail; roads off." }
};

/** The layers a preset turns on; every other layer is off. */
export function presetLayers(id: PresetId): readonly LayerId[] {
  return presets[id].layers;
}

/** The map as it opens: the Orders preset, which is the map as it was before layers existed. */
export const defaultLayers: readonly LayerId[] = presetLayers("orders");

/** The preset these layers match exactly, if any. */
export function activePreset(layers: readonly LayerId[]): PresetId | undefined {
  const on = new Set(layers);
  return presetIds.find((id) => presets[id].layers.length === on.size && presets[id].layers.every((layer) => on.has(layer)));
}

/** The layers with one switched the other way, in `layerIds` order. */
export function toggleLayer(layers: readonly LayerId[], id: LayerId): readonly LayerId[] {
  const on = new Set(layers);
  if (on.has(id)) on.delete(id);
  else on.add(id);
  return layerIds.filter((layer) => on.has(layer));
}

/** What an order in progress is, as the map view tells it. */
type OrderContext = Pick<MapView, "destinationIds" | "selectedAircraftId" | "selectedUnitIds">;

/**
 * The layers an order in progress switches on by itself: the rail while armies are selected
 * (where they can ride), the rail, roads and order lines while their destination is chosen, and
 * the order lines while an aircraft's mission is chosen.
 */
export function autoLayers(view: OrderContext): readonly LayerId[] {
  if (view.destinationIds.length > 0 && view.selectedUnitIds.size > 0) return ["rail", "roads", "order-lines"];
  if (view.selectedUnitIds.size > 0) return ["rail"];
  if (view.selectedAircraftId !== undefined) return ["order-lines"];
  return [];
}

/** The layers drawn: the player's choice plus what the order in progress switches on. The choice itself is kept. */
export function shownLayers(chosen: readonly LayerId[], view: OrderContext): readonly LayerId[] {
  const on = new Set([...chosen, ...autoLayers(view)]);
  return layerIds.filter((layer) => on.has(layer));
}

/** The layers that are off, as the map's `data-hidden-layers` attribute lists them for the stylesheet. */
export function hiddenLayers(shown: readonly LayerId[]): string {
  return layerIds.filter((layer) => !shown.includes(layer)).join(" ");
}

/** Note 4: every sub-territory's border and name show past this zoom (250%). */
export const subTerritoryBorderZoom = 2.5;

export function showsSubTerritoryBorders(zoom: number, layers: readonly LayerId[]): boolean {
  return layers.includes("sub-territories") && zoom > subTerritoryBorderZoom;
}

/** How a road is drawn, in screen pixels: main roads solid and heavier, tracks faint and dashed. */
export interface RoadStyle {
  readonly dash: string | undefined;
  readonly opacity: number;
  readonly width: number;
}

export function roadStyle(level: RoadLevel): RoadStyle {
  return level === "main"
    ? { dash: undefined, opacity: 0.7, width: 1.8 }
    : { dash: "3 3", opacity: 0.45, width: 1 };
}

/** The toolbar's footprint: a bar centred along the bottom of the free map on desktop, one button top right on a phone. */
const toolbarSize = { height: 46, width: 340 } as const;
const phoneButtonSize = { height: 48, width: 104 } as const;

/** U13: the screen area the layers control covers, so counters and names keep clear of it (V4). */
export function layersControlObstacle(layout: PaneLayout, viewport: Pick<Viewport, "height" | "insetRight" | "width">): ScreenRect {
  if (layout === "sheet") return { ...phoneButtonSize, x: viewport.width - phoneButtonSize.width, y: 0 };
  const free = viewport.width - viewport.insetRight;
  return { ...toolbarSize, x: free / 2 - toolbarSize.width / 2, y: viewport.height - toolbarSize.height };
}
