import { type JSX, useState } from "react";
import { requireUnitType } from "../../engine/lookup";
import type { Scenario, UnitState } from "../../engine/types";
import { unitDefinitionIn } from "../../engine/air/pieces";
import { useAppDispatch } from "../../hooks";
import { disbandSaving } from "../../presentation/recruitment";
import { unitName } from "../../presentation/text";
import { disbandUnit, removePlannedOrder } from "../../state/gameSlice";
import { canDisband, isDisbandPlanned, type PlanningSession } from "../../state/planning";

/** Moves keyboard focus to the button that takes over when the one just pressed goes. */
const focusOn = (button: HTMLButtonElement | null): void => { button?.focus(); };

/**
 * D1: Disband on a unit's card: what it saves and the button, then the second step ("Disband this
 * unit?"), and once ordered, the way back. Shown on every card that can disband.
 */
export function DisbandControls({ scenario, session, unit }: { readonly scenario: Scenario; readonly session: PlanningSession; readonly unit: UnitState }): JSX.Element | null {
  const dispatch = useAppDispatch();
  const [step, setStep] = useState<"confirm" | "offer" | "ordered">("offer");
  const typeId = unitDefinitionIn(scenario, session.game.state.raised, unit.id)?.type;
  if (typeId === undefined || !canDisband(scenario, session, unit)) return null;
  const name = unitName(scenario, unit.id);
  const saving = disbandSaving(scenario, requireUnitType(scenario, typeId));
  if (isDisbandPlanned(session.draft, unit.id)) {
    return (
      <div aria-label={`Disband ${name}`} className="disband-controls" data-step="ordered" role="group">
        <span>Goes home at the end of the turn.</span>
        <button onClick={() => { setStep("offer"); dispatch(removePlannedOrder(unit.id)); }} ref={step === "ordered" ? focusOn : undefined} type="button">Keep</button>
      </div>
    );
  }
  return step === "confirm" ? (
    <div aria-label={`Disband ${name}`} className="disband-controls" data-step="confirm" role="group">
      <span>{`Disband this unit? ${saving}.`}</span>
      <button className="disband-button" onClick={() => { setStep("ordered"); dispatch(disbandUnit(unit.id)); }} type="button">Disband</button>
      <button onClick={() => { setStep("offer"); }} ref={focusOn} type="button">Keep</button>
    </div>
  ) : (
    <div aria-label={`Disband ${name}`} className="disband-controls" data-step="offer" role="group">
      <span>{saving}</span>
      <button className="disband-button" onClick={() => { setStep("confirm"); }} type="button">Disband</button>
    </div>
  );
}
