import type { JSX } from "react";
import { EconomyIcon, projectIcon } from "../../components/economy/EconomyIcon";
import type { Scenario } from "../../engine/types";
import { glyphs } from "../../presentation/glyphs";
import { useAppDispatch } from "../../hooks";
import type { QueueEntry } from "../../presentation/queues";
import { cancelBuildOrder } from "../../state/gameSlice";

interface QueueListProps {
  readonly entries: readonly QueueEntry[];
  /** Read the list as a whole: "Barcelona build queue". */
  readonly label: string;
  /** Contested: the active item's bar is drawn paused. */
  readonly paused?: boolean;
  readonly scenario: Scenario;
}

/**
 * U9 (note 9): a build queue (units in training are `TrainingList`). Active items come first, each with its bar and turns
 * left; the items waiting behind them are numbered. Items ordered this turn can be cancelled.
 */
export function QueueList({ entries, label, paused = false, scenario }: QueueListProps): JSX.Element {
  const dispatch = useAppDispatch();
  return (
    <ol aria-label={label} className="queue-list" data-paused={paused}>
      {entries.map((entry, at) => {
        const active = entry.stage === "active";
        const { cancel } = entry;
        return (
          <li className={active ? "queue-active" : "queue-waiting"} key={entry.key}>
            <div className="queue-line">
              {active ? null : <span aria-hidden="true" className="queue-number">{entries.slice(0, at + 1).filter((other) => other.stage === "waiting").length}</span>}
              <span className="queue-name">
                <EconomyIcon name={projectIcon(scenario, entry.project)} />
                {active ? <strong>{entry.name}</strong> : entry.name}
              </span>
              <span className="queue-status">{entry.status}</span>
              {cancel === undefined ? null : (
                <button aria-label={`Cancel ${entry.name}`} className="text-button" onClick={() => dispatch(cancelBuildOrder(cancel.index))} type="button">Cancel</button>
              )}
            </div>
            {active ? (
              <div aria-label={`${entry.name} progress`} aria-valuemax={entry.total} aria-valuemin={0} aria-valuenow={entry.done} className="queue-bar" role="progressbar">
                <span style={{ width: `${String(Math.round((100 * entry.done) / Math.max(1, entry.total)))}%` }} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** U9: the mark on a contested territory's card. */
export function PausedChip(): JSX.Element {
  return <span className="paused-chip">{`Paused ${glyphs.dot} contested`}</span>;
}
