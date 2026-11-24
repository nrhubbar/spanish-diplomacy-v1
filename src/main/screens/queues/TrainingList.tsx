import type { JSX } from "react";
import type { Scenario } from "../../engine/types";
import { useAppDispatch } from "../../hooks";
import type { TrainingEntry } from "../../presentation/queues";
import { cancelRecruitOrder } from "../../state/gameSlice";
import { RecruitRow } from "./RecruitRow";

interface TrainingListProps {
  readonly entries: readonly TrainingEntry[];
  /** Read the list as a whole: "Barcelona training". */
  readonly label: string;
  /** Contested: the bars are drawn paused. */
  readonly paused: boolean;
  readonly scenario: Scenario;
}

/** The order's name, told apart from others of its kind given this turn: "Militia column, order 2 of 2". */
function cancelName(entries: readonly TrainingEntry[], entry: TrainingEntry): string {
  const alike = entries.filter((each) => each.cancel !== undefined && each.name === entry.name);
  return alike.length > 1 ? `${entry.name}, order ${String(alike.indexOf(entry) + 1)} of ${String(alike.length)}` : entry.name;
}

/** Units in training, each with its bar and turns left, then the orders given this turn, which can be cancelled. */
export function TrainingList({ entries, label, paused, scenario }: TrainingListProps): JSX.Element {
  const dispatch = useAppDispatch();
  return (
    <ol aria-label={label} className="recruit-list training-rows" data-paused={paused}>
      {entries.map((entry) => {
        const { cancel } = entry;
        return (
          <RecruitRow
            action={cancel === undefined ? null : (
              <button aria-label={`Cancel ${cancelName(entries, entry)}`} className="text-button" onClick={() => dispatch(cancelRecruitOrder(cancel))} type="button">Cancel</button>
            )}
            factionId={entry.factionId}
            key={entry.key}
            name={entry.name}
            owner={entry.owner}
            scenario={scenario}
            typeId={entry.typeId}
          >
            <span className="build-terms queue-status">{entry.status}</span>
            {entry.stage === "active" ? (
              <div aria-label={`${entry.name} progress`} aria-valuemax={entry.total} aria-valuemin={0} aria-valuenow={entry.done} className="queue-bar" role="progressbar">
                <span style={{ width: `${String(Math.round((100 * entry.done) / Math.max(1, entry.total)))}%` }} />
              </div>
            ) : null}
          </RecruitRow>
        );
      })}
    </ol>
  );
}
