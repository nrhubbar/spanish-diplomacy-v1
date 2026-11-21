import { type JSX, useId } from "react";
import type { Scenario } from "../../engine/types";
import { useAppDispatch } from "../../hooks";
import { glyphs } from "../../presentation/glyphs";
import { territoryName } from "../../presentation/text";
import { chooseOrderKind, clearUnitSelection } from "../../state/gameSlice";
import { orderChoices, type PlanningSession, selectionLabel } from "../../state/planning";
import type { Draft } from "../../state/session";

/**
 * U4: the pane's sticky footer, the action bar for the selection: "3 units selected, Madrid",
 * Clear, then one button per order the selection can take (the first is the main one). It also
 * carries the planning feedback. The pane shows it only when `hasSelectionBar`.
 */
export function SelectionBar({ scenario, session }: { readonly scenario: Scenario; readonly session: PlanningSession }): JSX.Element {
  const dispatch = useAppDispatch();
  const ids = useId();
  const { draft } = session;
  const count = draft.selectedUnitIds.length;
  const choices = draft.stage === undefined ? orderChoices(scenario, session) : [];
  return (
    <div className="selection-bar">
      {draft.feedback === undefined ? null : <p className="inline-feedback" role="status">{draft.feedback}</p>}
      {choices.length === 0 ? null : (
        <>
          <p className="selection-bar-summary">
            <strong>{selectionLabel(count)}</strong>
            {draft.selectedTerritoryId === undefined ? null : ` ${glyphs.dot} ${territoryName(scenario, draft.selectedTerritoryId)}`}
            <button className="text-button" onClick={() => dispatch(clearUnitSelection())} type="button">Clear</button>
          </p>
          <div aria-label="Orders for the selected units" className="selection-bar-actions" role="group">
            {choices.map(({ kind, ...choice }, index) => (
              <span className="selection-bar-choice" key={choice.key}>
                <button
                  aria-describedby={`${ids}-${choice.key}`}
                  className="selection-bar-action"
                  data-main={index === 0}
                  data-order-kind={kind}
                  disabled={choice.disabledReason !== undefined}
                  onClick={kind === undefined ? undefined : () => { dispatch(chooseOrderKind(kind)); }}
                  title={choice.description}
                  type="button"
                >
                  {choice.label}
                </button>
                <span className="visually-hidden" id={`${ids}-${choice.key}`}>{choice.description}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Whether the bar has anything to show: feedback, or units selected outside a destination choice. */
export function hasSelectionBar(draft: Draft): boolean {
  return draft.feedback !== undefined || (draft.stage === undefined && draft.selectedUnitIds.length > 0);
}
