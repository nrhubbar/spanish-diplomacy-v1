import type { JSX } from "react";
import { TerritoryView } from "./TerritoryView";
import type { PaneView } from "../../../state/paneSlice";
import type { PaneViewProps } from "./types";

/** U3, U9: the pane's "recruit" view: Territory Info on its Recruit tab. */
export function RecruitView({ scenario, session, view }: Omit<PaneViewProps, "view"> & { readonly view: Extract<PaneView, { readonly kind: "recruit" }> }): JSX.Element {
  return <TerritoryView scenario={scenario} session={session} tab="recruit" territoryId={view.territory} />;
}
