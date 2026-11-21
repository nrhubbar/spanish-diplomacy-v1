import type { JSX } from "react";
import { TerritoryView } from "./TerritoryView";
import type { PaneView } from "../../../state/paneSlice";
import type { PaneViewProps } from "./types";

/** U3, U9: the pane's "build" view: Territory Info on Buildings, with the named sub-territory's card open. */
export function BuildView({ scenario, session, view }: Omit<PaneViewProps, "view"> & { readonly view: Extract<PaneView, { readonly kind: "build" }> }): JSX.Element {
  return <TerritoryView scenario={scenario} session={session} subTerritory={view.subTerritory} tab="buildings" territoryId={view.territory} />;
}
