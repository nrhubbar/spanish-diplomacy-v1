import type { JSX } from "react";
import type { GameState, Scenario, UnitId } from "../../engine/types";
import { disbandQuestion, unitsNamed } from "../../presentation/recruitment";
import { focusWhenShown } from "../shell/focus";

interface DisbandConfirmProps {
  readonly onDisband: () => void;
  readonly onKeep: () => void;
  readonly scenario: Scenario;
  readonly state: GameState;
  readonly unitIds: readonly UnitId[];
}

/** D1, N1: Disband's second step, for a unit or for the selection: whom it sends home and what it saves. Focus starts on Keep. */
export function DisbandConfirm({ onDisband, onKeep, scenario, state, unitIds }: DisbandConfirmProps): JSX.Element {
  return (
    <div aria-label={`Disband ${unitsNamed(scenario, unitIds)}`} className="disband-controls" data-step="confirm" role="group">
      <span>{disbandQuestion(scenario, state, unitIds)}</span>
      <button className="disband-button" onClick={onDisband} type="button">Disband</button>
      <button onClick={onKeep} ref={focusWhenShown} type="button">Keep</button>
    </div>
  );
}
