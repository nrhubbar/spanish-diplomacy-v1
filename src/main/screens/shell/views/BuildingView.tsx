import type { JSX } from "react";
import { GlobalBuilding } from "../../queues/GlobalBuilding";
import type { PaneViewProps } from "./types";

/** U3, U9: the pane's "building" view, Global Building. */
export function BuildingView({ scenario, session }: PaneViewProps): JSX.Element {
  return <GlobalBuilding scenario={scenario} session={session} />;
}
