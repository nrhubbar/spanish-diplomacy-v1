import type { JSX } from "react";
import { Navigate } from "react-router";
import { IberiaMap } from "../components/IberiaMap";
import { ExitGameButton } from "../components/ExitGameButton";
import type { TerritoryId } from "../engine/types";
import { useAppDispatch, useAppSelector } from "../hooks";
import { milestone2Scenario } from "../scenarios/milestone2Scenario";
import { addWarningNotification } from "../state/notificationSlice";
import {
  addDraftMove,
  chooseMoveAction,
  chooseMoveDestination,
  removeDraftOrder,
  selectActiveFaction,
  selectAllAvailableUnitsInTerritory,
  selectCanAddMove,
  selectCityControl,
  selectControl,
  selectDraftAction,
  selectDraftOrders,
  selectGamePhase,
  selectLegalDestinationIds,
  selectSelectedDestinationId,
  selectSelectedFromTerritoryId,
  selectSelectedUnitIds,
  selectSubmissionStatus,
  selectTurnDate,
  selectUnits,
  selectValidationMessage,
  selectTerritory,
  selectUnit,
  submitCurrentOrders
} from "../state/gameSlice";

export function OrderSubmissionScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const activeFaction = useAppSelector(selectActiveFaction);
  const canAddMove = useAppSelector(selectCanAddMove);
  const cityControl = useAppSelector(selectCityControl);
  const control = useAppSelector(selectControl);
  const draftAction = useAppSelector(selectDraftAction);
  const draftOrders = useAppSelector(selectDraftOrders);
  const legalDestinationIds = useAppSelector(selectLegalDestinationIds);
  const phase = useAppSelector(selectGamePhase);
  const selectedDestinationId = useAppSelector(selectSelectedDestinationId);
  const selectedFromTerritoryId = useAppSelector(selectSelectedFromTerritoryId);
  const selectedUnitIds = useAppSelector(selectSelectedUnitIds);
  const submissionStatus = useAppSelector(selectSubmissionStatus);
  const turnDate = useAppSelector(selectTurnDate);
  const units = useAppSelector(selectUnits);
  const validationMessage = useAppSelector(selectValidationMessage);
  const territoryUnits = units.filter((unit) => unit.territoryId === selectedFromTerritoryId);
  const territoryCities = milestone2Scenario.cities.filter((city) => city.territoryId === selectedFromTerritoryId);
  const orderedUnitIds = new Set(draftOrders.map((order) => order.unitId));
  const availableTerritoryUnits = territoryUnits.filter(
    (unit) => unit.factionId === activeFaction.id && !orderedUnitIds.has(unit.id)
  );

  if (phase === "handoff") return <Navigate to="/handoff" replace />;
  if (phase === "resolution") return <Navigate to="/resolution" replace />;
  if (phase === "game-over") return <Navigate to="/game-over" replace />;
  if (phase !== "planning") return <Navigate to={phase === "idle" ? "/" : "/setup"} replace />;

  function selectMapTerritory(territoryId: TerritoryId): void {
    if (draftAction === "move") {
      if (!legalDestinationIds.includes(territoryId)) dispatch(addWarningNotification("That territory is not a legal destination."));
      dispatch(chooseMoveDestination(territoryId));
      return;
    }
    dispatch(selectTerritory(territoryId));
  }

  return (
    <main className="screen game-screen" aria-labelledby="orders-title">
      <div className="screen-heading-row">
        <div>
          <p className="screen-kicker">{turnDate} · At this device</p>
          <h1 id="orders-title">{activeFaction.name}</h1>
        </div>
        <ExitGameButton />
      </div>
      <p className="screen-copy">Select formations, plan one move for each, then submit the complete order set.</p>
      <div className="game-layout">
        <IberiaMap
          cities={milestone2Scenario.cities}
          cityControl={cityControl}
          control={control}
          factions={milestone2Scenario.factions}
          legalDestinationIds={legalDestinationIds}
          onSelectTerritory={selectMapTerritory}
          onSelectUnit={(unitId) => dispatch(selectUnit(unitId))}
          plannedOrders={draftOrders}
          selectedDestinationId={selectedDestinationId}
          selectedFromTerritoryId={selectedFromTerritoryId}
          selectedUnitIds={selectedUnitIds}
          units={units}
        />
        <aside className="order-panel" aria-label="Order builder">
          <h2>Order Builder</h2>
          {selectedFromTerritoryId === undefined ? <p>Select a territory to inspect its formations.</p> : (
            <>
              <p className="territory-heading">{territoryName(selectedFromTerritoryId)}</p>
              {territoryCities.length > 0 ? <p className="territory-cities">Cities: {territoryCities.map((city) => city.name).join(", ")}</p> : null}
              {territoryUnits.length === 0 ? <p>No formations present.</p> : (
                <>
                  <button
                    className="text-button select-all-button"
                    disabled={availableTerritoryUnits.length === 0}
                    onClick={() => dispatch(selectAllAvailableUnitsInTerritory())}
                    type="button"
                  >
                    Select all available
                  </button>
                  <ul className="formation-list">
                    {territoryUnits.map((unit) => {
                      const hasOrder = orderedUnitIds.has(unit.id);
                      return (
                        <li key={unit.id}>
                          <button
                            className={`${selectedUnitIds.includes(unit.id) ? "formation-button formation-button-selected" : "formation-button"}${hasOrder ? " formation-button-ordered" : ""}`}
                            disabled={unit.factionId !== activeFaction.id || hasOrder}
                            onClick={() => dispatch(selectUnit(unit.id))}
                            type="button"
                          >
                            <span>{unit.displayName}{hasOrder ? <strong className="formation-order-status">Ordered</strong> : null}</span>
                            <small>{unit.formationKind} · {unit.strength} personnel</small>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
              <button type="button" disabled={selectedUnitIds.length === 0} onClick={() => dispatch(chooseMoveAction())}>Move selected</button>
            </>
          )}
          {draftAction === "move" ? <p>Destination: {selectedDestinationId === undefined ? "choose a highlighted territory" : territoryName(selectedDestinationId)}</p> : null}
          {validationMessage === undefined ? null : <p className="feedback-message">{validationMessage}</p>}
          <button type="button" disabled={!canAddMove} onClick={() => dispatch(addDraftMove())}>Add Move</button>
          <div className="draft-orders">
            <h3>Planned orders</h3>
            {draftOrders.length === 0 ? <p>All formations will hold.</p> : (
              <ul>{draftOrders.map((order) => <li key={order.unitId}>{unitName(order.unitId)} → {territoryName(order.to)} <button aria-label={`Remove ${unitName(order.unitId)} order`} className="text-button" onClick={() => dispatch(removeDraftOrder(order.unitId))} type="button">Remove</button></li>)}</ul>
            )}
          </div>
          <button className="lock-orders-button" type="button" onClick={() => dispatch(submitCurrentOrders())}>Submit Orders</button>
        </aside>
      </div>
      <section className="status-strip" aria-label="Submission status">
        {submissionStatus.map((status) => <span className={status.ready ? "status-ready" : "status-waiting"} key={status.factionId}>{status.factionName}: {status.ready ? "Ready" : "Planning"}</span>)}
      </section>
    </main>
  );
}

function territoryName(territoryId: TerritoryId): string {
  return milestone2Scenario.territories.find((territory) => territory.id === territoryId)!.name;
}
function unitName(unitId: string): string { return milestone2Scenario.units[unitId]!.displayName; }
