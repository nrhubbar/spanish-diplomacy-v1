import { type JSX, useRef } from "react";
import type { Scenario } from "../../engine/types";
import { useAppDispatch } from "../../hooks";
import { feedbackText } from "../../presentation/feedback";
import { glyphs } from "../../presentation/glyphs";
import { selectionLabel } from "../../presentation/orderMenu";
import { territoryName } from "../../presentation/text";
import { clearUnitSelection } from "../../state/gameSlice";
import type { PlanningSession } from "../../state/planning";
import type { Draft } from "../../state/session";
import { OrderMenu } from "./OrderMenu";

/**
 * U4: the pane's sticky footer, the action bar for the selection: "3 units selected, Madrid",
 * Clear, then the order menu (`OrderMenu`). It also carries the planning feedback. The pane shows it only when `hasSelectionBar`.
 */
export function SelectionBar({ scenario, session }: { readonly scenario: Scenario; readonly session: PlanningSession }): JSX.Element {
  const dispatch = useAppDispatch();
  const bar = useRef<HTMLDivElement>(null);
  const { draft } = session;
  const count = draft.selectedUnitIds.length;
  return (
    // Takes focus when an order empties the menu, so it is not dropped.
    <div className="selection-bar" ref={bar} tabIndex={-1}>
      {draft.feedback === undefined ? null : <p className="inline-feedback" role="status">{feedbackText(scenario, draft.feedback)}</p>}
      {draft.stage !== undefined || count === 0 ? null : (
        <>
          <p className="selection-bar-summary">
            <strong>{selectionLabel(count)}</strong>
            {draft.selectedTerritoryId === undefined ? null : ` ${glyphs.dot} ${territoryName(scenario, draft.selectedTerritoryId)}`}
            <button className="text-button" onClick={() => dispatch(clearUnitSelection())} type="button">Clear</button>
          </p>
          <OrderMenu label="Orders for the selected units" onChosen={() => { bar.current?.focus(); }} scenario={scenario} session={session} />
        </>
      )}
    </div>
  );
}

/** Whether the bar has anything to show: feedback, or units selected outside a destination choice. */
export function hasSelectionBar(draft: Draft): boolean {
  return draft.feedback !== undefined || (draft.stage === undefined && draft.selectedUnitIds.length > 0);
}
