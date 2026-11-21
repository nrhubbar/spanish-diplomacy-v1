import type { JSX } from "react";
import { andList, buildingGroups, buildingSummary, countOf } from "../../presentation/queues";
import { useAppDispatch } from "../../hooks";
import { pushView } from "../../state/paneSlice";
import { plannedBuilds, previewState } from "../../state/planning";
import type { PaneViewProps } from "../shell/views/types";
import { PausedChip, QueueList } from "./QueueList";

/**
 * U9: Global Building, opened from the top bar: every build queue of the viewer's, by
 * territory, then sub-territory, with this turn's Build orders. A contested territory's queues
 * are marked paused. Each sub-territory's name opens its card in Territory Info.
 */
export function GlobalBuilding({ scenario, session }: Omit<PaneViewProps, "view">): JSX.Element {
  const dispatch = useAppDispatch();
  const groups = buildingGroups(scenario, previewState(scenario, session), session.factionId, plannedBuilds(session));
  const summary = buildingSummary(scenario, groups);
  return (
    <section aria-label="Building" className="pane-section global-queues">
      <p className="pane-hint">Every site with work under way or queued</p>
      <p className="queue-summary">
        <span><strong>{summary.underWay}</strong> under way</span>
        <span><strong>{summary.queued}</strong> queued</span>
        {summary.paused === 0 ? null : <span><strong>{summary.paused}</strong> paused</span>}
        {summary.finishing.length === 0 ? null : <span className="queue-summary-spend">{`${andList(summary.finishing)} ${summary.finishing.length === 1 ? "finishes" : "finish"} at the end of this turn`}</span>}
      </p>
      {groups.length === 0 ? <p className="pane-hint">Nothing is being built. Build from a territory's Buildings tab.</p> : (
        <ul className="queue-groups">
          {groups.map((group) => (
            <li className="queue-group" data-paused={group.paused} key={group.territoryId}>
              <header className="queue-group-head">
                <h4>{group.name}</h4>
                {group.paused ? <PausedChip /> : <span className="pane-hint">{countOf(group.sites.length, "site", "sites")}</span>}
              </header>
              {group.sites.map((site) => (
                <div className="queue-site" key={site.subTerritoryId}>
                  <div className="queue-site-head">
                    <button className="queue-site-name" onClick={() => dispatch(pushView({ kind: "build", subTerritory: site.subTerritoryId, territory: group.territoryId }))} type="button">{site.name}</button>
                    <span className="pane-hint">{`${String(site.entries.length)} in queue`}</span>
                  </div>
                  <QueueList entries={site.entries} label={`${site.name} build queue`} paused={group.paused} scenario={scenario} />
                </div>
              ))}
              {group.paused ? <p className="queue-paused-note">{`Work stops while ${group.name} is contested; progress is kept.`}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
