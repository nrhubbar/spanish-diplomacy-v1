import type { JSX } from "react";
import { isContested, subTerritoriesOf } from "../../engine/economy/holdings";
import { plannedBuilds, previewState } from "../../state/planning";
import { SiteCard } from "./build/SiteCard";
import { plannedAt } from "./build/planned";
import type { TerritoryTabProps } from "./TerritoryTabs";

/**
 * X3, X7: the territory's sub-territories as cards: development pips, buildings, and the build
 * queue with progress bars. Each of the player's cards has a Build button that focuses the pane
 * on it, where the build list is.
 */
export function BuildTab({ scenario, session, territoryId }: TerritoryTabProps): JSX.Element {
  const state = previewState(scenario, session);
  const builds = plannedBuilds(session);
  const subs = subTerritoriesOf(scenario, territoryId);
  return (
    <div className="build-tab">
      <div className="build-tab-head">
        <h4>Sub-territories</h4>
        <span className="pane-hint">Build on one of yours to queue work</span>
      </div>
      {isContested(scenario, state.subTerritories, territoryId) ? (
        <p className="pane-callout build-paused">Contested: queues here are paused, and the territory pays no income.</p>
      ) : null}
      <ul className="site-cards">
        {subs.map((sub) => (
          <li key={sub.id}>
            <SiteCard planned={plannedAt(builds, sub.id)} scenario={scenario} state={state} subTerritoryId={sub.id} viewer={session.factionId} withBuildButton />
          </li>
        ))}
      </ul>
    </div>
  );
}
