import { type JSX, useId } from "react";
import { requireFaction, requireUnitDefinition, requireUnitType } from "../engine/lookup";
import type { Scenario, UnitState } from "../engine/types";
import { useAppDispatch } from "../hooks";
import { armyFigures, demoralizedRule } from "../presentation/army";
import { glyphs } from "../presentation/glyphs";
import { clearUnitSelection, selectAllAvailableUnits, toggleUnitSelection } from "../state/gameSlice";
import type { PlanningSession } from "../state/planning";
import { ArmyLine } from "./ArmyLine";
import { OrderCommand } from "./OrderCommand";

interface ArmyPickerProps {
  readonly own: readonly UnitState[];
  readonly scenario: Scenario;
  readonly session: PlanningSession;
}

/** The player's armies in the selected territory, each with its figures, and the order command. */
export function ArmyPicker({ own, scenario, session }: ArmyPickerProps): JSX.Element {
  const dispatch = useAppDispatch();
  const headingId = useId();
  const { draft, game } = session;
  const ordered = new Set(draft.orders.map((order) => order.unitId));
  const available = own.filter((unit) => !ordered.has(unit.id));
  const selectedCount = draft.selectedUnitIds.length;
  const choosingDestination = draft.stage?.step === "choose-destination";
  const shakenSelected = own.some((unit) => unit.morale.demoralized && draft.selectedUnitIds.includes(unit.id));

  return (
    <div className="army-picker">
      <div className="army-picker-header">
        <h4 id={headingId}>Your armies</h4>
        <span className="selection-count">{available.length === 0 ? "All have orders" : `${String(selectedCount)} of ${String(available.length)} selected`}</span>
      </div>
      <ul aria-labelledby={headingId} className="formation-list">
        {own.map((unit) => {
          const definition = requireUnitDefinition(scenario, unit.id);
          const isOrdered = ordered.has(unit.id);
          return (
            <li key={unit.id}>
              <button
                aria-pressed={draft.selectedUnitIds.includes(unit.id)}
                className="formation-button"
                data-ordered={isOrdered}
                disabled={choosingDestination}
                onClick={() => dispatch(toggleUnitSelection(unit.id))}
                type="button"
              >
                <span aria-hidden="true" className="formation-check" />
                <span className="formation-name">{definition.name}</span>
                <span className="formation-meta">
                  {[requireUnitType(scenario, definition.type).name, isOrdered ? "order planned" : undefined].filter(Boolean).join(` ${glyphs.dot} `)}
                </span>
                <ArmyLine factionColor={requireFaction(scenario, unit.factionId).color} figures={armyFigures(scenario, game.state, unit)} />
              </button>
            </li>
          );
        })}
      </ul>
      {shakenSelected ? <p className="pane-note" data-tone="demoralized">{demoralizedRule(scenario)}</p> : null}
      {choosingDestination ? null : (
        <>
          {available.length === 0 ? null : (
            // Always enabled: disabling the control just used would drop keyboard focus.
            <div className="selection-tools">
              <button className="text-button" onClick={() => dispatch(selectAllAvailableUnits())} type="button">Select all</button>
              <button className="text-button" onClick={() => dispatch(clearUnitSelection())} type="button">Clear</button>
            </div>
          )}
          <OrderCommand availableCount={available.length} menuOpen={draft.stage?.step === "choose-order"} selectedCount={selectedCount} />
        </>
      )}
    </div>
  );
}
