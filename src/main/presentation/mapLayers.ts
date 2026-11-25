import { unitKindIn } from "../engine/air/pieces";
import type { GameState, Scenario, UnitKind } from "../engine/types";

/** U13 (Q-R2-8): the map's layers, their names, and the presets that switch several at once. */

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

/** The kinds of unit standing on the board, for the legend. */
export function kindsOnBoard(scenario: Scenario, state: Pick<GameState, "raised" | "units">): ReadonlySet<UnitKind> {
  return new Set(Object.values(state.units).map((unit) => unitKindIn(scenario, state.raised, unit.id)));
}
