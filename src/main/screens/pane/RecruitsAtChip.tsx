import type { JSX } from "react";
import { EconomyIcon } from "../../components/economy/EconomyIcon";
import { SiteIcon } from "../../components/SiteIcons";
import { recruitingAt } from "../../presentation/holdings";
import type { TerritoryTabProps } from "./TerritoryTabs";

/**
 * Territory meta row: where the territory recruits, "Recruits at Barcelona" (M5, R2, W3), shown
 * to the faction that holds the territory and its capital sub-territory. In contested ground,
 * which pauses recruiting (C8), it says "No recruiting" (M12). Renders nothing elsewhere.
 */
export function RecruitsAtChip({ scenario, session, territoryId }: TerritoryTabProps): JSX.Element | null {
  const recruiting = recruitingAt(scenario, session.game.state, territoryId, session.factionId);
  if (recruiting === "paused") {
    return (
      <span className="site-chip" data-tone="paused">
        <SiteIcon kind="paused" />
        No recruiting
      </span>
    );
  }
  if (recruiting === undefined) return null;
  return (
    <span className="site-chip recruits-at-chip">
      <EconomyIcon name="flag" />
      {`Recruits at ${recruiting.place}`}
    </span>
  );
}
