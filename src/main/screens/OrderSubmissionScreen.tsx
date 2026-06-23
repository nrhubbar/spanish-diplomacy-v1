import type { JSX } from "react";
import { Navigate } from "react-router";
import { AbstractMap } from "../components/AbstractMap";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  chooseMoveDestination,
  selectActiveFaction,
  selectActiveUnit,
  selectGamePhase,
  selectLegalDestinationIds,
  selectSelectedDestinationId,
  selectSelectedTerritoryId,
  selectSubmittedOrders,
  selectUnits,
  selectValidationMessage,
  submitMove,
  submitNoMove
} from "../state/gameSlice";

export function OrderSubmissionScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const phase = useAppSelector(selectGamePhase);
  const activeFaction = useAppSelector(selectActiveFaction);
  const activeUnit = useAppSelector(selectActiveUnit);
  const legalDestinationIds = useAppSelector(selectLegalDestinationIds);
  const selectedDestinationId = useAppSelector(selectSelectedDestinationId);
  const selectedTerritoryId = useAppSelector(selectSelectedTerritoryId);
  const submittedOrders = useAppSelector(selectSubmittedOrders);
  const units = useAppSelector(selectUnits);
  const validationMessage = useAppSelector(selectValidationMessage);

  if (phase === "idle" || phase === "setup") {
    return <Navigate to="/setup" replace />;
  }

  if (phase === "resolution") {
    return <Navigate to="/resolution" replace />;
  }

  return (
    <section className="screen game-screen" aria-labelledby="orders-title">
      <p className="screen-kicker">Turn order</p>
      <h1 id="orders-title">{activeFaction.name} Order Submission</h1>
      <p className="screen-copy">
        Select a highlighted destination for {activeUnit.id}, or submit no move.
      </p>

      <AbstractMap
        legalDestinationIds={legalDestinationIds}
        onSelectTerritory={(territoryId) => dispatch(chooseMoveDestination(territoryId))}
        selectedDestinationId={selectedDestinationId}
        selectedTerritoryId={selectedTerritoryId}
        units={units}
      />

      <div className="action-row">
        <button type="button" disabled={selectedDestinationId === undefined} onClick={() => dispatch(submitMove())}>
          Submit Move
        </button>
        <button type="button" className="secondary-button" onClick={() => dispatch(submitNoMove())}>
          Submit No Move
        </button>
      </div>

      {validationMessage === undefined ? null : <p className="feedback-message">{validationMessage}</p>}

      <section className="debug-panel" aria-labelledby="submitted-orders-title">
        <h2 id="submitted-orders-title">Visible Submitted Orders</h2>
        {submittedOrders.length === 0 ? (
          <p>No orders submitted yet.</p>
        ) : (
          <ul>
            {submittedOrders.map((order) => (
              <li key={order.factionId}>
                {order.factionName}: {order.description}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
