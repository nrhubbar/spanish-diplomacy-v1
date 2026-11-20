import type { JSX } from "react";
import type { TerritoryTabProps } from "./TerritoryTabs";

/**
 * Territory meta row slot: what the territory pays its holder each turn, "Pays +11 Funds ·
 * +4k men a turn" ($2, X1). TODO(m3r1-economy-builds): render it; until then it renders nothing.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the slot's data, read once its slice lands
export function IncomeChip(_props: TerritoryTabProps): JSX.Element | null {
  return null;
}
