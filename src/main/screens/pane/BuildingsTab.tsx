import type { JSX } from "react";
import { isContested, subTerritoriesOf } from "../../engine/economy/holdings";
import type { SubTerritoryId } from "../../engine/types";
import { useAppDispatch } from "../../hooks";
import { plannedAt } from "../../presentation/queues";
import { focusSubTerritory } from "../../state/gameSlice";
import { plannedBuilds, previewState } from "../../state/planning";
import { SiteCard } from "./build/SiteCard";
import type { TerritoryTabProps } from "./TerritoryTabs";

/**
 * U9 (note 15), X3, X7: the territory's sub-territories as cards that open. `TerritoryTabs`
 * keeps which card is open: the sub-territory focused on the map, else the one a Build view
 * names. Opening a card focuses its sub-territory, so the map follows; closing it drops the focus.
 */
export function BuildingsTab({ expanded, onExpand, scenario, session, territoryId }: TerritoryTabProps & { readonly expanded: SubTerritoryId | undefined; readonly onExpand: (id: SubTerritoryId | undefined) => void }): JSX.Element {
  const dispatch = useAppDispatch();
  const state = previewState(scenario, session);
  const builds = plannedBuilds(session);
  return (
    <div className="build-tab">
      <div className="build-tab-head">
        <h4>Sub-territories</h4>
        <span className="pane-hint">Open one to queue work</span>
      </div>
      {isContested(scenario, state.subTerritories, territoryId) ? (
        <p className="pane-callout build-paused">Contested: queues here are paused, and the territory pays no income.</p>
      ) : null}
      <ul className="site-cards">
        {subTerritoriesOf(scenario, territoryId).map((sub) => (
          <li key={sub.id}>
            <SiteCard
              expanded={expanded === sub.id}
              onToggle={() => {
                const next = expanded === sub.id ? undefined : sub.id;
                onExpand(next);
                dispatch(focusSubTerritory(next));
              }}
              planned={plannedAt(builds, sub.id)}
              scenario={scenario}
              state={state}
              subTerritoryId={sub.id}
              viewer={session.factionId}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
