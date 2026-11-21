import type { JSX } from "react";
import { amountText } from "../../presentation/economy";
import { countOf, recruitmentGroups, recruitmentSummary } from "../../presentation/queues";
import { recruitSlots } from "../../engine/recruitment/rules";
import { useAppDispatch } from "../../hooks";
import { pushView } from "../../state/paneSlice";
import type { PaneViewProps } from "../shell/views/types";
import { PausedChip, QueueList } from "./QueueList";

/**
 * U9: Global Recruitment, opened from the top bar: every unit of the viewer's in training and
 * every Recruit order this turn, by territory. Each territory's name opens its Recruit tab.
 */
export function GlobalRecruitment({ scenario, session }: Omit<PaneViewProps, "view">): JSX.Element {
  const dispatch = useAppDispatch();
  const { factionId, game } = session;
  const recruits = session.draft.recruits ?? [];
  const groups = recruitmentGroups(scenario, game.state, factionId, recruits);
  const summary = recruitmentSummary(scenario, game.state, factionId, recruits);
  const committed = amountText(scenario, summary.committed);
  return (
    <section aria-label="Recruitment" className="pane-section global-queues">
      <p className="pane-hint">Everything training or ordered, by territory</p>
      <p className="queue-summary">
        <span><strong>{summary.training}</strong> in training</span>
        <span><strong>{summary.readyNext}</strong> ready next turn</span>
        <span><strong>{summary.ordered}</strong> ordered this turn</span>
        {committed === "nothing" ? null : <span className="queue-summary-spend">{`${committed} committed`}</span>}
      </p>
      {groups.length === 0 ? <p className="pane-hint">Nothing is training. Recruit from a territory's Recruit tab.</p> : (
        <ul className="queue-groups">
          {groups.map((group) => {
            const slots = recruitSlots(scenario, game.state, group.territoryId);
            return (
              <li className="queue-group" data-paused={group.paused} key={group.territoryId}>
                <header className="queue-group-head">
                  <button className="queue-group-name" onClick={() => dispatch(pushView({ kind: "recruit", territory: group.territoryId }))} type="button">{group.name}</button>
                  {group.paused ? <PausedChip /> : <span className="pane-hint">{`${countOf(slots, "Recruit order", "Recruit orders")} a turn`}</span>}
                </header>
                <QueueList entries={group.entries} label={`${group.name} training`} paused={group.paused} scenario={scenario} />
                {group.paused ? <p className="queue-paused-note">{`Training pauses while ${group.name} is contested; progress is kept.`}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="pane-hint">Every unit in training takes a turn off each turn. New Recruit orders start when orders are revealed.</p>
    </section>
  );
}
