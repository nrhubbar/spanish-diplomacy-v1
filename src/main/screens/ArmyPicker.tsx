import { type JSX, useId } from "react";
import { requireFaction, requireUnitDefinition, requireUnitType } from "../engine/lookup";
import type { Scenario, UnitState } from "../engine/types";
import { useAppDispatch } from "../hooks";
import { armyFigures, demoralizedRule, orderStatus } from "../presentation/army";
import { glyphs } from "../presentation/glyphs";
import { clearUnitSelection, selectAllAvailableUnits, toggleUnitSelection } from "../state/gameSlice";
import { blockedOrders, enemyPresent, orderKindsFor, orderOf, type PlanningSession, selectedWithdrawRoutes } from "../state/planning";
import type { OrderKind } from "../state/session";
import { replenishDetail } from "../presentation/recruitment";
import { territoryName } from "../presentation/text";
import { routeNames } from "../engine/partition/paths";
import { ArmyLine } from "./ArmyLine";
import { OrderCommand } from "./OrderCommand";
import { GeneralControls } from "./pane/AirPane";

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
  const moves = new Map(draft.orders.map((order) => [order.unitId, order]));
  const available = own.filter((unit) => !moves.has(unit.id));
  const selectedCount = draft.selectedUnitIds.length;
  const choosingDestination = draft.stage?.step === "choose-destination";
  const shakenSelected = own.some((unit) => unit.morale.demoralized && draft.selectedUnitIds.includes(unit.id));
  const kinds = orderKindsFor(session, scenario);

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
              <GeneralControls scenario={scenario} session={session} unit={unit} />
            </li>
          );
        })}
      </ul>
      {shakenSelected ? <p className="pane-note" data-tone="demoralized">{demoralizedRule(scenario)}</p> : null}
      {choosingDestination ? null : (
        <>
          {available.length === 0 && selectedCount === 0 ? null : (
            // Always enabled: disabling the control just used would drop keyboard focus.
            <div className="selection-tools">
              <button className="text-button" onClick={() => dispatch(selectAllAvailableUnits())} type="button">Select all</button>
              <button className="text-button" onClick={() => dispatch(clearUnitSelection())} type="button">Clear</button>
            </div>
          )}
          <OrderCommand
            availableCount={available.length}
            {...contestedMenu(scenario, session, kinds)}
            details={{ replenish: replenishDetail(scenario, game.state, own.filter((unit) => draft.selectedUnitIds.includes(unit.id))) }}
            kinds={kinds}
            menuOpen={draft.stage?.step === "choose-order"}
            selectedCount={selectedCount}
          />
        </>
      )}
    </div>
  );
}

/**
 * C1 (Q-UX-14): in contested ground the menu offers Attack (the default) and Withdraw, naming
 * where Withdraw leads and through which of the player's own sub-territories; the other orders
 * are shown greyed out with the reason.
 */
function contestedMenu(scenario: Scenario, session: PlanningSession, kinds: readonly OrderKind[]): { readonly blocked?: ReturnType<typeof blockedOrders>; readonly descriptions?: Partial<Record<OrderKind, string>> } {
  const territoryId = session.draft.selectedTerritoryId;
  if (!kinds.includes("withdraw") || territoryId === undefined) return {};
  const routes = selectedWithdrawRoutes(scenario, session);
  const territory = territoryName(scenario, territoryId);
  const through = [...new Set(routes.flatMap((route) => routeNames(scenario, route)))];
  const fatigue = scenario.rules.dice === "d20-graded" ? "; +1 fatigue" : "";
  return {
    blocked: blockedOrders(scenario),
    descriptions: {
      attack: enemyPresent(session, territoryId)
        ? `Default here. Joins the standing battle for ${territory}${fatigue}.`
        : `Default here. Takes one enemy sub-territory of ${territory} a turn, the capital last.`,
      withdraw: routes.length === 0
        ? "No way out: every neighbouring territory you hold is cut off from your sub-territories here."
        : `To ${orList(routes.map((route) => territoryName(scenario, route.to)))}, through your own sub-territories (${through.join(", ")}).`
    }
  };
}

function orList(names: readonly string[]): string {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} or ${String(names.at(-1))}`;
}
