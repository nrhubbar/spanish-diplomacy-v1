import type { JSX } from "react";
import { heldBy, isContested, isPartitioned, subTerritoriesOf } from "../../engine/partition/holders";
import { glyphs } from "../../presentation/glyphs";
import { SiteIcon } from "./SiteIcons";
import type { TerritoryTabProps } from "./TerritoryTabs";

/**
 * Territory meta row: "Contested \u00b7 you hold 3 of 8" in contested ground (W6, C1, X8), so the
 * player sees at once why the orders are Attack and Withdraw, then (M12, `ux-orders-contested`)
 * "Builds paused" when the scenario builds. The income chip says "No income" and the recruit
 * chip "No recruiting". Renders nothing elsewhere.
 */
export function ContestedChip({ scenario, session, territoryId }: TerritoryTabProps): JSX.Element | null {
  const { state } = session.game;
  if (!isPartitioned(scenario) || !isContested(scenario, state, territoryId)) return null;
  const total = subTerritoriesOf(scenario, territoryId).length;
  const own = heldBy(scenario, state.subTerritories, territoryId, session.factionId).length;
  return (
    <>
      <span className="site-chip" data-tone="contested">
        <SiteIcon kind="contested" />
        {`Contested ${glyphs.dot} you hold ${String(own)} of ${String(total)}`}
      </span>
      {scenario.rules.economy === "none" ? null : (
        <span className="site-chip" data-tone="paused">
          <SiteIcon kind="paused" />
          Builds paused
        </span>
      )}
    </>
  );
}
