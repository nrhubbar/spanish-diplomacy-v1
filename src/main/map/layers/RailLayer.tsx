import type { JSX } from "react";
import type { MapLayerProps } from "./slots";

/** Map layer: main lines at full-map zoom, every line zoomed in, the network selected units can ride (X6). TODO(m3r1-movement-rail-ports): draw it; until then it draws nothing. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the layer's data, read once its slice lands
export function RailLayer(_props: MapLayerProps): JSX.Element | null {
  return null;
}
