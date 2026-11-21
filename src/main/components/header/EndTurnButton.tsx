import { type JSX, useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import type { Scenario } from "../../engine/types";
import { useAppDispatch } from "../../hooks";
import { glyphs } from "../../presentation/glyphs";
import { territoryName, unitName } from "../../presentation/text";
import { endTurn } from "../../state/gameSlice";
import { armiesWithoutOrders, type PlanningSession } from "../../state/planning";
import { ShellIcon } from "./ShellIcon";

/**
 * U1, U2 (Q-R2B-4): End Turn, orange-red with an hourglass. It asks first only when some armies
 * have no order, listing them, with End anyway and Back.
 */
export function EndTurnButton({ scenario, session }: { readonly scenario: Scenario; readonly session: PlanningSession }): JSX.Element {
  const dispatch = useAppDispatch();
  const [confirming, setConfirming] = useState(false);
  const back = useCallback(() => { setConfirming(false); }, []);
  return (
    <>
      <button
        className="end-turn-button"
        onClick={() => {
          if (armiesWithoutOrders(scenario, session).length === 0) dispatch(endTurn());
          else setConfirming(true);
        }}
        type="button"
      >
        <ShellIcon name="hourglass" />
        End Turn
      </button>
      {confirming ? <EndTurnConfirm onBack={back} scenario={scenario} session={session} /> : null}
    </>
  );
}

function EndTurnConfirm({ onBack, scenario, session }: { readonly onBack: () => void; readonly scenario: Scenario; readonly session: PlanningSession }): JSX.Element {
  const dispatch = useAppDispatch();
  const id = useId();
  const armies = armiesWithoutOrders(scenario, session);
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { if (event.key === "Escape") onBack(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); };
  }, [onBack]);
  return createPortal(
    <div aria-describedby={`${id}-body`} aria-labelledby={`${id}-title`} aria-modal="true" className="end-turn-cover" role="alertdialog">
      <div className="end-turn-card">
        <h2 id={`${id}-title`}>{`${String(armies.length)} ${armies.length === 1 ? "army has" : "armies have"} no order`}</h2>
        <p id={`${id}-body`}>If you end the turn now, they keep their standing order: entrench, or rest while demoralized, and attack in contested ground.</p>
        <ul aria-label="Armies with no order" className="plain-list end-turn-list">
          {armies.map((army) => <li key={army.id}>{`${unitName(scenario, army.id)} ${glyphs.dot} ${territoryName(scenario, army.territoryId)}`}</li>)}
        </ul>
        <div className="end-turn-actions">
          <button className="end-turn-button" onClick={() => { onBack(); dispatch(endTurn()); }} type="button">End anyway</button>
          {/* Back takes focus, so a stray Enter does not end the turn. */}
          <button autoFocus className="secondary-button" onClick={onBack} type="button">Back</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
