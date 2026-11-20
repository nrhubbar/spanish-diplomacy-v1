import type { JSX } from "react";
import type { TerritoryTabProps } from "./TerritoryTabs";

/** Pane tab: the territory's sub-territories, their development and build queues (X3, X7). TODO(m3r1-economy-builds): fill it; until then it is present but empty. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the tab's data, read once its slice lands
export function BuildTab(_props: TerritoryTabProps): JSX.Element {
  return <div className="pane-tab-empty" />;
}
