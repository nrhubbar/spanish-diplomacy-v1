import { type JSX, useId } from "react";
import { requireFaction, requireUnitDefinition, requireUnitType } from "../engine/lookup";
import type { Scenario, UnitState } from "../engine/types";
import { useAppDispatch } from "../hooks";
import { armyFigures, demoralizedRule, orderStatus } from "../presentation/army";
import { glyphs } from "../presentation/glyphs";
import { selectAllAvailableUnits, toggleUnitSelection } from "../state/gameSlice";
import { orderOf, type PlanningSession } from "../state/planning";
import { replenishDetail } from "../presentation/recruitment";
import { territoryName } from "../presentation/text";
import { ArmyLine } from "./ArmyLine";
import { GeneralControls } from "./pane/AirPane";
import { DisbandControls } from "./pane/DisbandControls";

interface ArmyPickerProps {
  readonly own: readonly UnitState[];
  readonly scenario: Scenario;
  readonly session: PlanningSession;
}

/** The player's armies in the selected territory, each with its figures. Their orders are given from the selection bar (U4). */
export function ArmyPicker({ own, scenario, session }: ArmyPickerProps): JSX.Element {
  const dispatch = useAppDispatch();
  const headingId = useId();
  const { draft, game } = session;
  const moves = new Map(draft.orders.map((order) => [order.unitId, order]));
  const available = own.filter((unit) => !moves.has(unit.id));
  const selectedCount = draft.selectedUnitIds.length;
  const choosingDestination = draft.stage?.step === "choose-destination";
  const shakenSelected = own.some((unit) => unit.morale.demoralized && draft.selectedUnitIds.includes(unit.id));

  return (
    <div className="army-picker">
      <div className="army-picker-header">
        <h4 id={headingId}>Your units</h4>
        <span className="selection-count">{available.length === 0 && selectedCount === 0 ? "All moving" : `${String(selectedCount)} of ${String(own.length)} selected`}</span>
      </div>
      <ul aria-labelledby={headingId} className="formation-list">
        {own.map((unit) => {
          const definition = requireUnitDefinition(scenario, unit.id);
          const move = moves.get(unit.id);
          const kind = orderOf(session, unit, scenario);
          const order = move !== undefined
            ? `${move.kind === "withdraw" ? "Withdrawing" : "Moving"} to ${territoryName(scenario, move.to)}`
            : kind === "replenish" ? `${orderStatus[kind]} (${replenishDetail(scenario, game.state, [unit]).split(",")[0] ?? ""})` : orderStatus[kind];
          return (
            <li key={unit.id}>
              <button
                aria-pressed={draft.selectedUnitIds.includes(unit.id)}
                className="formation-button"
                data-ordered={move !== undefined}
                disabled={choosingDestination}
                onClick={() => dispatch(toggleUnitSelection(unit.id))}
                type="button"
              >
                <span aria-hidden="true" className="formation-check" />
                <span className="formation-name">{definition.name}</span>
                <span className="formation-meta">
                  {`${requireUnitType(scenario, definition.type).name} ${glyphs.dot} ${order}`}
                </span>
                {/* X7, R5 (m3r1-recruit-replenish): how far below strength, where Replenish exists. */}
                {scenario.rules.recruitment !== "none" && unit.strength < definition.fullStrength
                  ? <span className="below-strength-chip">{`Below strength: ${String(definition.fullStrength - unit.strength)} men short`}</span>
                  : null}
                <ArmyLine factionColor={requireFaction(scenario, unit.factionId).color} figures={armyFigures(scenario, game.state, unit)} />
              </button>
              <DisbandControls scenario={scenario} session={session} unit={unit} />
              <GeneralControls scenario={scenario} session={session} unit={unit} />
            </li>
          );
        })}
      </ul>
      {shakenSelected ? <p className="pane-note" data-tone="demoralized">{demoralizedRule(scenario)}</p> : null}
      {choosingDestination || (available.length === 0 && selectedCount === 0) ? null : (
        // Always enabled: disabling the control just used would drop keyboard focus.
        <div className="selection-tools">
          <button className="text-button" onClick={() => dispatch(selectAllAvailableUnits())} type="button">Select all</button>
        </div>
      )}
    </div>
  );
}
