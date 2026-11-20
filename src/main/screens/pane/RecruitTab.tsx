import type { JSX } from "react";
import type { TerritoryTabProps } from "./TerritoryTabs";

/** Pane tab: every unit type with values, cost, training time and quantity, locked types saying why (X4). TODO(m3r1-recruit-replenish): fill it; until then it is present but empty. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the tab's data, read once its slice lands
export function RecruitTab(_props: TerritoryTabProps): JSX.Element {
  return <div className="pane-tab-empty" />;
}
