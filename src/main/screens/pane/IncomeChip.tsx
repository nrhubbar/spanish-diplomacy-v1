import type { JSX } from "react";
import { TerritoryIncomeChip } from "./build/TerritoryIncomeChip";
import type { TerritoryTabProps } from "./TerritoryTabs";

/**
 * Territory meta row slot: what the territory pays a turn ($2, X1), "Pays +3 Funds \u00b7 +6
 * Manpower a turn", or that a contested territory pays nobody. Owner: m3r1-economy-builds.
 */
export function IncomeChip({ scenario, session, territoryId }: TerritoryTabProps): JSX.Element | null {
  return <TerritoryIncomeChip scenario={scenario} state={session.game.state} territoryId={territoryId} viewer={session.factionId} />;
}
