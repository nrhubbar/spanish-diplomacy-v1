import type { JSX } from "react";
import type { TerritoryTabProps } from "./TerritoryTabs";

/**
 * Territory meta row slot: where the territory recruits, "Recruits at Barcelona" (R2, W3).
 * TODO(m3r1-recruit-replenish): render it; until then it renders nothing.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the slot's data, read once its slice lands
export function RecruitsAtChip(_props: TerritoryTabProps): JSX.Element | null {
  return null;
}
