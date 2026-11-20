import type { JSX } from "react";
import { citiesIn, requireFaction } from "../engine/lookup";
import type { Scenario, TerritoryId } from "../engine/types";
import { useAppDispatch } from "../hooks";
import { armyFigures } from "../presentation/army";
import type { DestinationEstimate } from "../presentation/odds";
import { controlDescription, factionName, route, territoryName, unitName } from "../presentation/text";
import { cancelOrderStage, removePlannedOrder } from "../state/gameSlice";
import { orderCounts, type PlanningSession } from "../state/planning";
import { TerritoryWeather } from "../components/weather/TerritoryWeather";
import { ArmyLine } from "./ArmyLine";
import { ArmyPicker } from "./ArmyPicker";
import { DestinationChoices } from "./DestinationChoices";
import { armies } from "./OrderCommand";
import { SubTerritoryFocus } from "./pane/SubTerritoryFocus";
import { TerritoryTabs } from "./pane/TerritoryTabs";
import { PlannedOddsInfo, PlannedOrderOdds } from "./PlannedOrderOdds";

/**
 * Moves keyboard focus to a control as it appears, so focus is not lost when the button that
 * opened a step unmounts. A hidden copy (the collapsed sheet) cannot take focus and is skipped.
 */
export function focusWhenShown(element: HTMLElement | null): void {
  element?.focus();
}

interface BuilderProps {
  readonly scenario: Scenario;
  readonly session: PlanningSession;
}

/**
 * The Orders pane body: the selected territory, its armies, the order command, the odds at each
 * destination while one is being chosen (C15), and the planned orders.
 */
export function OrderBuilder({ estimates, scenario, session }: BuilderProps & { readonly estimates: ReadonlyMap<TerritoryId, DestinationEstimate> }): JSX.Element {
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
        {choosingDestination && estimates.size > 0 ? <DestinationChoices estimates={estimates} scenario={scenario} /> : null}
        {territoryId === undefined ? (
          <p className="pane-hint">Select a territory or one of your armies on the map.</p>
        ) : (
          draft.focusedSubTerritoryId === undefined ? (
            <TerritoryTabs key={territoryId} scenario={scenario} session={session} territoryId={territoryId}>
              <TerritoryDetails scenario={scenario} session={session} territoryId={territoryId} />
            </TerritoryTabs>
          ) : <SubTerritoryFocus scenario={scenario} subTerritoryId={draft.focusedSubTerritoryId} />
        )}
        {draft.feedback === undefined ? null : <p className="inline-feedback" role="status">{draft.feedback}</p>}
      </section>
      <section aria-labelledby="planned-orders-title" className="pane-section">
        <h3 id="planned-orders-title">Your orders</h3>
        <OrderSummary session={session} />
        {draft.orders.length === 0 ? (
          <p className="pane-hint">No moves yet. Armies without a move entrench, or rest while demoralized.</p>
        ) : (
          <ul aria-label={`Planned moves (${String(draft.orders.length)})`} className="order-list">
            {draft.orders.map((order) => (
              <li key={order.unitId}>
                <span>
                  <span className="order-unit">{unitName(scenario, order.unitId)}</span>
                  <span className="order-route">{route(scenario, order)}</span>
                  <PlannedOrderOdds scenario={scenario} session={session} territoryId={order.to} />
                </span>
                <button aria-label={`Remove order for ${unitName(scenario, order.unitId)}`} className="text-button" onClick={() => dispatch(removePlannedOrder(order.unitId))} type="button">Remove</button>
              </li>
            ))}
          </ul>
        )}
        <PlannedOddsInfo scenario={scenario} session={session} />
      </section>
    </>
  );
}

/** O1: every army has one order, so the counts add up to all of the player's armies. */
function OrderSummary({ session }: { readonly session: PlanningSession }): JSX.Element {
  const counts = orderCounts(session);
  return (
    <p className="pane-meta order-summary">
      {`${String(counts.move)} moving, ${String(counts.entrench)} entrenching, ${String(counts.rest)} resting`}
    </p>
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
      <TerritoryWeather scenario={scenario} state={game.state} territoryId={territoryId} />
      {cities.length === 0 ? null : <p className="pane-meta">{`Cities: ${cities.map((city) => city.name).join(", ")}`}</p>}
      {own.length === 0 ? null : <ArmyPicker own={own} scenario={scenario} session={session} />}
      {others.length === 0 ? null : (
        <div className="other-formations">
          <h4>Other armies here</h4>
          <ul className="plain-list other-army-list">
            {others.map((unit) => (
              <li key={unit.id}>
                <span className="formation-name">{unitName(scenario, unit.id)}</span>
                <span className="formation-meta">{factionName(scenario, unit.factionId)}</span>
                <ArmyLine factionColor={requireFaction(scenario, unit.factionId).color} figures={armyFigures(scenario, game.state, unit)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
