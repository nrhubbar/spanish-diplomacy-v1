import { type JSX, useRef, useState } from "react";
import type { Scenario, UnitState } from "../../engine/types";
import { useAppDispatch } from "../../hooks";
import { unitName } from "../../presentation/text";
import { disbandUnit, removePlannedOrder } from "../../state/gameSlice";
import { canDisband, isDisbandPlanned, type PlanningSession } from "../../state/planning";
import { DisbandConfirm } from "./DisbandConfirm";

interface DisbandProps {
  readonly scenario: Scenario;
  readonly session: PlanningSession;
  readonly unit: UnitState;
}

/** D1: on the card of a unit ordered to disband: that it goes home, and the way back. Keep hands focus to the unit's own button. */
export function DisbandPlanned({ scenario, session, unit }: DisbandProps): JSX.Element | null {
  const dispatch = useAppDispatch();
  if (!isDisbandPlanned(session.draft, unit.id)) return null;
  const keep = (button: HTMLButtonElement): void => {
    button.closest("li")?.querySelector("button")?.focus();
    dispatch(removePlannedOrder(unit.id));
  };
  return <GoesHome name={unitName(scenario, unit.id)} onKeep={keep} />;
}

function GoesHome({ name, onKeep }: { readonly name: string; readonly onKeep: (button: HTMLButtonElement) => void }): JSX.Element {
  return (
    <div aria-label={`Disband ${name}`} className="disband-controls" data-step="ordered" role="group">
      <span>Goes home at the end of the turn.</span>
      <button onClick={(event) => { onKeep(event.currentTarget); }} type="button">Keep</button>
    </div>
  );
}

/** N1: Disband among an aircraft's missions, with the same second step as the order menu. */
export function AircraftDisband({ scenario, session, unit }: DisbandProps): JSX.Element | null {
  const dispatch = useAppDispatch();
  const button = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  if (!canDisband(scenario, session, unit)) return null;
  const planned = isDisbandPlanned(session.draft, unit.id);
  const close = (): void => {
    setConfirming(false);
    button.current?.focus();
  };
  const keep = (): void => {
    close();
    dispatch(removePlannedOrder(unit.id));
  };
  return (
    <>
      <button
        aria-expanded={confirming}
        aria-pressed={planned}
        className="air-mission-button"
        onClick={() => { setConfirming(!planned && !confirming); }}
        ref={button}
        type="button"
      >
        Disband
      </button>
      {planned ? <GoesHome name={unitName(scenario, unit.id)} onKeep={keep} /> : confirming ? (
        <DisbandConfirm
          onDisband={() => { close(); dispatch(disbandUnit(unit.id)); }}
          onKeep={close}
          scenario={scenario}
          state={session.game.state}
          unitIds={[unit.id]}
        />
      ) : null}
    </>
  );
}
