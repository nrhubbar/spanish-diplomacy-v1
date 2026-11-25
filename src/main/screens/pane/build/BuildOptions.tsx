import type { JSX } from "react";
import type { FactionId, GameState, Scenario, SubTerritoryId } from "../../../engine/types";
import { useAppDispatch } from "../../../hooks";
import { buildOptions } from "../../../presentation/siteCard";
import { EconomyIcon, projectIcon } from "../../../components/economy/EconomyIcon";
import { queueBuildOrder } from "../../../state/gameSlice";

interface BuildOptionsProps {
  readonly scenario: Scenario;
  /** The viewer's state with this turn's Build orders previewed as queued (`previewState`). */
  readonly state: GameState;
  readonly subTerritoryId: SubTerritoryId;
  readonly viewer: FactionId;
}

/**
 * X3, $4, $5: "Add to the queue" inside an open sub-territory card. Every project the scenario
 * offers here is listed with its price, time and effect; one that cannot be queued says why.
 * Queued items are paid when orders are revealed.
 */
export function BuildOptions({ scenario, state, subTerritoryId, viewer }: BuildOptionsProps): JSX.Element | null {
  const dispatch = useAppDispatch();
  // Projects that can be queued come first; locked ones follow, each saying why.
  const options = buildOptions(scenario, state, subTerritoryId, viewer);
  if (options === undefined) return null;
  return (
    <section aria-labelledby={`${subTerritoryId}-add`} className="build-options">
      <div className="build-tab-head">
        <h4 id={`${subTerritoryId}-add`}>Add to the queue</h4>
        <span className="pane-hint">Paid when queued</span>
      </div>
      <ul>
        {options.map(({ name, order, project, refusal, terms }) => (
          <li className={refusal === undefined ? "build-option" : "build-option build-option-locked"} key={name}>
            <div>
              <strong><EconomyIcon name={projectIcon(scenario, project)} />{name}</strong>
              <span className="build-terms">{terms}</span>
              {refusal === undefined ? null : <span className="build-locked">{refusal}</span>}
            </div>
            {refusal === undefined ? (
              <button aria-label={`Queue ${name}`} className="secondary-button compact-button" onClick={() => dispatch(queueBuildOrder(order))} type="button">Queue</button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
