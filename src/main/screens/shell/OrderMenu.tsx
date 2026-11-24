import { type JSX, useId, useState } from "react";
import type { Scenario } from "../../engine/types";
import { useAppDispatch } from "../../hooks";
import { chooseOrderKind } from "../../state/gameSlice";
import { disbandableSelection, orderChoices, type PlanningSession } from "../../state/planning";
import type { OrderKind } from "../../state/session";
import { DisbandConfirm } from "../pane/DisbandConfirm";
import { focusWhenShown } from "./focus";

interface OrderMenuProps {
  /** Focus the first order when the menu appears (it was opened by a button). */
  readonly focusFirst?: boolean;
  readonly label: string;
  /** Called when an order was given. */
  readonly onChosen?: () => void;
  /** Large rows, each with its description in view; otherwise a compact line of buttons. */
  readonly rows?: boolean;
  readonly scenario: Scenario;
  readonly session: PlanningSession;
}

/**
 * U4, N1: the orders the selected units can take, one button each (the first is the main one).
 * The selection bar shows it, and the button after the unit list opens it. Disband asks once
 * more before it is given. A changed selection starts it over.
 */
export function OrderMenu(props: OrderMenuProps): JSX.Element {
  return <Orders key={props.session.draft.selectedUnitIds.join()} {...props} />;
}

function Orders({ focusFirst = false, label, onChosen, rows = false, scenario, session }: OrderMenuProps): JSX.Element {
  const dispatch = useAppDispatch();
  const ids = useId();
  const [step, setStep] = useState<"choose" | "confirm" | "kept">("choose");
  const choices = orderChoices(scenario, session);
  const give = (kind: OrderKind): void => {
    onChosen?.();
    dispatch(chooseOrderKind(kind));
  };
  if (step === "confirm") {
    return (
      <DisbandConfirm
        onDisband={() => { give("disband"); }}
        onKeep={() => { setStep("kept"); }}
        scenario={scenario}
        state={session.game.state}
        unitIds={disbandableSelection(scenario, session)}
      />
    );
  }
  return (
    <div aria-label={label} className="selection-bar-actions" data-rows={rows} role="group">
      {choices.map(({ kind, ...choice }, index) => (
        <span className="selection-bar-choice" key={choice.key}>
          <button
            aria-describedby={`${ids}-${choice.key}`}
            className="selection-bar-action"
            data-main={index === 0}
            data-order-kind={kind}
            disabled={choice.disabledReason !== undefined}
            onClick={kind === undefined ? undefined : () => { if (kind === "disband") setStep("confirm"); else give(kind); }}
            ref={(step === "kept" && kind === "disband") || (step === "choose" && focusFirst && index === 0) ? focusWhenShown : undefined}
            title={rows ? undefined : choice.description}
            type="button"
          >
            {choice.label}
          </button>
          <span className={rows ? "selection-bar-description" : "visually-hidden"} id={`${ids}-${choice.key}`}>{choice.description}</span>
        </span>
      ))}
    </div>
  );
}
