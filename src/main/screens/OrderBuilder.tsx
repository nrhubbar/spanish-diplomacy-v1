import { type JSX, useId } from "react";
import { citiesIn, requireUnitDefinition } from "../engine/lookup";
import type { Scenario, TerritoryId, UnitState } from "../engine/types";
import { useAppDispatch } from "../hooks";
import { glyphs } from "../presentation/glyphs";
import { controlDescription, factionName, route, territoryName, unitName } from "../presentation/text";
import {
  cancelOrderStage,
  chooseOrderKind,
  clearUnitSelection,
  removePlannedOrder,
  selectAllAvailableUnits,
  toggleOrderMenu,
  toggleUnitSelection
} from "../state/gameSlice";
import { orderKinds, type PlanningSession } from "../state/planning";
import type { OrderKind } from "../state/session";

/** Player-facing name and one-line explanation for each order type. */
const orderLabels: Readonly<Record<OrderKind, { readonly description: string; readonly label: string }>> = {
  move: { description: "March to a neighboring territory.", label: "Move" }
};

export function armies(count: number): string {
  return `${String(count)} ${count === 1 ? "army" : "armies"}`;
}

/**
 * Moves keyboard focus to a control as it appears, so focus is not lost when the button that
 * opened a step unmounts. A hidden copy (the collapsed sheet) cannot take focus and is skipped.
 */
export function focusWhenShown(element: HTMLElement | null): void {
  element?.focus();
}

/** Brings the order choice into view as it opens, for the short mobile sheet. */
function revealWhenShown(element: HTMLElement | null): void {
  element?.scrollIntoView({ block: "nearest" });
}

interface BuilderProps {
  readonly scenario: Scenario;
  readonly session: PlanningSession;
}

/** The Orders pane body: the selected territory, its armies, the order command, and planned orders. */
export function OrderBuilder({ scenario, session }: BuilderProps): JSX.Element {
  const dispatch = useAppDispatch();
  const { draft } = session;
  const territoryId = draft.selectedTerritoryId;
  const choosingDestination = draft.stage?.step === "choose-destination";

  return (
    <>
      <section aria-label="Selected territory" className="pane-section">
        {choosingDestination ? (
          <div className="pane-callout" role="status">
            <p>{`Moving ${armies(draft.selectedUnitIds.length)} from ${territoryId === undefined ? "" : territoryName(scenario, territoryId)}. Choose a highlighted territory on the map.`}</p>
            <button className="text-button" onClick={() => dispatch(cancelOrderStage())} ref={focusWhenShown} type="button">Cancel move</button>
          </div>
        ) : null}
        {territoryId === undefined ? (
          <p className="pane-hint">Select a territory or one of your armies on the map.</p>
        ) : (
          <TerritoryDetails scenario={scenario} session={session} territoryId={territoryId} />
        )}
        {draft.feedback === undefined ? null : <p className="inline-feedback" role="status">{draft.feedback}</p>}
      </section>
      <section aria-labelledby="planned-orders-title" className="pane-section">
        <h3 id="planned-orders-title">{`Planned orders (${String(draft.orders.length)})`}</h3>
        {draft.orders.length === 0 ? (
          <p className="pane-hint">No orders yet. Armies without orders hold their ground.</p>
        ) : (
          <ul className="order-list">
            {draft.orders.map((order) => (
              <li key={order.unitId}>
                <span>
                  <span className="order-unit">{unitName(scenario, order.unitId)}</span>
                  <span className="order-route">{route(scenario, order)}</span>
                </span>
                <button aria-label={`Remove order for ${unitName(scenario, order.unitId)}`} className="text-button" onClick={() => dispatch(removePlannedOrder(order.unitId))} type="button">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function TerritoryDetails({ scenario, session, territoryId }: BuilderProps & { readonly territoryId: TerritoryId }): JSX.Element {
  const { factionId, game } = session;
  const unitsHere = Object.values(game.state.units).filter((unit) => unit.territoryId === territoryId);
  const own = unitsHere.filter((unit) => unit.factionId === factionId);
  const others = unitsHere.filter((unit) => unit.factionId !== factionId);
  const cities = citiesIn(scenario, territoryId);

  return (
    <>
      <h3>{territoryName(scenario, territoryId)}</h3>
      <p className="pane-meta">{controlDescription(scenario, game.state.control[territoryId])}</p>
      {cities.length === 0 ? null : <p className="pane-meta">{`Cities: ${cities.map((city) => city.name).join(", ")}`}</p>}
      {own.length === 0 ? null : <ArmyPicker own={own} scenario={scenario} session={session} />}
      {others.length === 0 ? null : (
        <div className="other-formations">
          <h4>Other armies here</h4>
          <ul className="plain-list">
            {others.map((unit) => <li key={unit.id}>{`${unitName(scenario, unit.id)} (${factionName(scenario, unit.factionId)})`}</li>)}
          </ul>
        </div>
      )}
    </>
  );
}

function ArmyPicker({ own, scenario, session }: BuilderProps & { readonly own: readonly UnitState[] }): JSX.Element {
  const dispatch = useAppDispatch();
  const ids = useId();
  const { draft } = session;
  const ordered = new Set(draft.orders.map((order) => order.unitId));
  const available = own.filter((unit) => !ordered.has(unit.id));
  const selectedCount = draft.selectedUnitIds.length;
  const choosingDestination = draft.stage?.step === "choose-destination";
  const menuOpen = draft.stage?.step === "choose-order";
  const headingId = `${ids}-heading`;
  const hintId = `${ids}-hint`;
  const menuId = `${ids}-menu`;

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
                  {[definition.formationKind, definition.approximateStrength === undefined ? undefined : `about ${String(definition.approximateStrength)}`, isOrdered ? "order planned" : undefined].filter(Boolean).join(` ${glyphs.dot} `)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {choosingDestination ? null : (
        <>
          {available.length === 0 ? null : (
            // Always enabled: disabling the control just used would drop keyboard focus.
            <div className="selection-tools">
              <button className="text-button" onClick={() => dispatch(selectAllAvailableUnits())} type="button">Select all</button>
              <button className="text-button" onClick={() => dispatch(clearUnitSelection())} type="button">Clear</button>
            </div>
          )}
          <div className="order-command" data-menu-open={menuOpen}>
            <button
              aria-controls={menuOpen ? menuId : undefined}
              aria-describedby={selectedCount === 0 ? hintId : undefined}
              aria-expanded={menuOpen}
              className="order-button"
              disabled={selectedCount === 0}
              onClick={() => dispatch(toggleOrderMenu())}
              type="button"
            >
              <span>Give Selected Armies Order</span>
              <svg aria-hidden="true" className="order-button-caret" focusable="false" viewBox="0 0 12 8">
                <path d="M1.5 1.75 6 6.25l4.5-4.5" />
              </svg>
            </button>
            {selectedCount === 0 ? (
              <p className="pane-hint" id={hintId}>
                {available.length === 0 ? "Every army here has an order. Remove one below to change it." : "Select at least one army to give an order."}
              </p>
            ) : null}
            {menuOpen ? (
              <div aria-label={`Order for ${armies(selectedCount)}`} className="order-menu" id={menuId} ref={revealWhenShown} role="group">
                {orderKinds.map((kind) => (
                  // The whole card is the button's hit area; the description stays outside its name.
                  <div className="order-choice" data-order-kind={kind} key={kind}>
                    <span aria-hidden="true" className="order-choice-icon" />
                    <button
                      aria-describedby={`${ids}-${kind}`}
                      className="order-choice-button"
                      onClick={() => dispatch(chooseOrderKind(kind))}
                      type="button"
                    >
                      {orderLabels[kind].label}
                    </button>
                    <span className="order-choice-description" id={`${ids}-${kind}`}>{orderLabels[kind].description}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
