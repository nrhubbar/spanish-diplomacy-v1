import type { JSX } from "react";
import type { MapLayerProps } from "./slots";

/** Map layer: provinces in contested territories, faint diagonal lines, names and capital stars on zoom (X2). TODO(m3r1-sub-territories): draw it; until then it draws nothing. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the layer's data, read once its slice lands
export function SubTerritoryLayer(_props: MapLayerProps): JSX.Element | null {
  return null;
}
