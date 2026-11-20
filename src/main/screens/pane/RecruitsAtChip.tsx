import type { JSX } from "react";
import { EconomyIcon } from "../../components/economy/EconomyIcon";
import { capitalOf, holdsTerritory, isContested } from "../../engine/recruitment/rules";
import { SiteIcon } from "./SiteIcons";
import type { TerritoryTabProps } from "./TerritoryTabs";

/**
 * Territory meta row: where the territory recruits, "Recruits at Barcelona" (M5, R2, W3), shown
 * to the faction that holds the territory and its capital sub-territory. In contested ground,
 * which pauses recruiting (C8), it says "No recruiting" (M12). Renders nothing elsewhere.
 */
export function RecruitsAtChip({ scenario, session, territoryId }: TerritoryTabProps): JSX.Element | null {
  if (scenario.rules.recruitment === "none") return null;
  const { state } = session.game;
  if (isContested(scenario, state, territoryId)) {
    return (
      <span className="site-chip" data-tone="paused">
        <SiteIcon kind="paused" />
        No recruiting
      </span>
    );
  }
  if (!holdsTerritory(scenario, state, session.factionId, territoryId)) return null;
  const capital = capitalOf(scenario, territoryId);
  const place = capital === undefined ? scenario.index.territories.get(territoryId)?.name : scenario.index.subTerritories.get(capital)?.name;
  if (place === undefined) return null;
  return (
    <span className="site-chip recruits-at-chip">
      <EconomyIcon name="flag" />
      {`Recruits at ${place}`}
    </span>
  );
}
