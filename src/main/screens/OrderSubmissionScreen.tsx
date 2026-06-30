import type { JSX } from "react";
import { Navigate } from "react-router";
import { AbstractMap } from "../components/AbstractMap";
import type { TerritoryId } from "../engine/types";
import { useAppDispatch, useAppSelector } from "../hooks";
import { milestone1Scenario } from "../scenarios/milestone1Scenario";
import { addWarningNotification } from "../state/notificationSlice";
import {
  chooseMoveAction,
  chooseMoveDestination,
  selectActiveFaction,
  selectCanSubmit,
  selectControl,
  selectDraftAction,
  selectGamePhase,
  selectHistory,
  selectLegalDestinationIds,
  selectSelectedDestinationId,
  selectSelectedFromTerritoryId,
  selectSelectedUnitIds,
  selectSubmittedOrders,
  selectTurnDate,
  selectUnits,
  selectValidationMessage,
  selectTerritory,
  selectUnit,
  submitCurrentOrder
} from "../state/gameSlice";

export function OrderSubmissionScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const activeFaction = useAppSelector(selectActiveFaction);
  const canSubmit = useAppSelector(selectCanSubmit);
  const control = useAppSelector(selectControl);
  const draftAction = useAppSelector(selectDraftAction);
  const history = useAppSelector(selectHistory);
  const legalDestinationIds = useAppSelector(selectLegalDestinationIds);
  const phase = useAppSelector(selectGamePhase);
  const selectedDestinationId = useAppSelector(selectSelectedDestinationId);
  const selectedFromTerritoryId = useAppSelector(selectSelectedFromTerritoryId);
  const selectedUnitIds = useAppSelector(selectSelectedUnitIds);
  const submittedOrders = useAppSelector(selectSubmittedOrders);
  const turnDate = useAppSelector(selectTurnDate);
  const units = useAppSelector(selectUnits);
  const validationMessage = useAppSelector(selectValidationMessage);
  const selectedFriendlyUnits = units.filter((unit) => selectedUnitIds.includes(unit.id));
  const fromTerritoryUnits = units.filter(
    (unit) => unit.territoryId === selectedFromTerritoryId && unit.factionId === activeFaction.id
  );

  if (phase === "idle" || phase === "setup") {
    return <Navigate to="/setup" replace />;
  }

  if (phase === "resolution") {
    return <Navigate to="/resolution" replace />;
  }

  function selectMapTerritory(territoryId: TerritoryId): void {
    if (draftAction === "move") {
      if (!legalDestinationIds.includes(territoryId)) {
        dispatch(addWarningNotification("That territory is not a legal destination."));
      }

      dispatch(chooseMoveDestination(territoryId));
      return;
    }

    dispatch(selectTerritory(territoryId));
  }

  return (
    <section className="screen game-screen" aria-labelledby="orders-title">
      <p className="screen-kicker">{turnDate}</p>
      <h1 id="orders-title">{activeFaction.name} Order Submission</h1>
      <p className="screen-copy">
        Select a friendly territory or counter, choose move, pick a destination, then submit.
      </p>

      <div className="game-layout">
        <AbstractMap
          control={control}
          factions={milestone1Scenario.factions}
          legalDestinationIds={legalDestinationIds}
          onSelectTerritory={selectMapTerritory}
          onSelectUnit={(unitId) => dispatch(selectUnit(unitId))}
          selectedDestinationId={selectedDestinationId}
          selectedFromTerritoryId={selectedFromTerritoryId}
          selectedUnitIds={selectedUnitIds}
          units={units}
        />

        <aside className="order-panel" aria-label="Order builder">
          <h2>Order Builder</h2>
          {selectedFromTerritoryId === undefined ? (
            <p>Select one of your territories or counters.</p>
          ) : (
            <>
              <p>From: {selectedFromTerritoryId}</p>
              {fromTerritoryUnits.length === 0 ? (
                <p>No friendly units here.</p>
              ) : (
                <ul className="unit-list">
                  {fromTerritoryUnits.map((unit) => (
                    <li key={unit.id}>
                      <label>
                        <input checked={selectedUnitIds.includes(unit.id)} readOnly type="checkbox" />
                        {unit.displayName}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" disabled={selectedUnitIds.length === 0} onClick={() => dispatch(chooseMoveAction())}>
                Move
              </button>
            </>
          )}

          {draftAction === "move" ? (
            <p>
              To: {selectedDestinationId ?? "select a highlighted destination"}
            </p>
          ) : null}

          {selectedFriendlyUnits.length > 0 ? (
            <p>Selected: {selectedFriendlyUnits.map((unit) => unit.displayName).join(", ")}</p>
          ) : null}

          {validationMessage === undefined ? null : <p className="feedback-message">{validationMessage}</p>}

          <button type="button" disabled={!canSubmit} onClick={() => dispatch(submitCurrentOrder())}>
            Submit
          </button>
        </aside>
      </div>

      <section className="debug-panel" aria-labelledby="submitted-orders-title">
        <h2 id="submitted-orders-title">Submission Status</h2>
        {submittedOrders.length === 0 ? (
          <p>No players have submitted yet.</p>
        ) : (
          <ul>
            {submittedOrders.map((order) => (
              <li key={order.factionId}>{order.factionName} submitted orders.</li>
            ))}
          </ul>
        )}
      </section>

      <section className="debug-panel" aria-labelledby="turn-history-title">
        <h2 id="turn-history-title">Turn History</h2>
        {history.length === 0 ? (
          <p>No resolved turns yet.</p>
        ) : (
          <ul>
            {history.map((entry) => (
              <li key={entry.turnNumber}>
                Turn {entry.turnNumber}: {entry.summaryLines.join(" ")}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
