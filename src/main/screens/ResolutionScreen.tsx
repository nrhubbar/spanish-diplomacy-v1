import type { JSX } from "react";
import { Navigate, useNavigate } from "react-router";
import { IberiaMap } from "../components/IberiaMap";
import { useAppDispatch, useAppSelector } from "../hooks";
import { milestone1Scenario } from "../scenarios/milestone1Scenario";
import {
  selectControl,
  selectGamePhase,
  selectResolution,
  selectResolutionSummary,
  selectSubmittedOrders,
  selectTurnDate,
  selectUnitsWithFactionNames,
  startNextTurn
} from "../state/gameSlice";

export function ResolutionScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const control = useAppSelector(selectControl);
  const phase = useAppSelector(selectGamePhase);
  const resolution = useAppSelector(selectResolution);
  const resolutionSummary = useAppSelector(selectResolutionSummary);
  const submittedOrders = useAppSelector(selectSubmittedOrders);
  const turnDate = useAppSelector(selectTurnDate);
  const units = useAppSelector(selectUnitsWithFactionNames);

  if (phase === "orders") {
    return <Navigate to="/orders" replace />;
  }

  if (phase !== "resolution") {
    return <Navigate to="/setup" replace />;
  }

  return (
    <section className="screen game-screen" aria-labelledby="resolution-title">
      <p className="screen-kicker">{turnDate}</p>
      <h1 id="resolution-title">Resolution Summary</h1>

      <div className="game-layout">
        <IberiaMap
          control={control}
          factions={milestone1Scenario.factions}
          legalDestinationIds={[]}
          onSelectTerritory={() => undefined}
          onSelectUnit={() => undefined}
          resolutionOutcomes={resolution?.outcomes ?? []}
          selectedDestinationId={undefined}
          selectedFromTerritoryId={undefined}
          selectedUnitIds={[]}
          units={units}
        />

        <section className="debug-panel resolution-panel" aria-labelledby="revealed-orders-title">
          <h2 id="revealed-orders-title">Revealed Orders</h2>
          <ul>
            {submittedOrders.map((order) => (
              <li key={order.factionId}>
                {order.factionName}: {order.description}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="debug-panel" aria-labelledby="resolution-lines-title">
        <h2 id="resolution-lines-title">Outcomes</h2>
        <ul>
          {resolutionSummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="debug-panel" aria-labelledby="final-positions-title">
        <h2 id="final-positions-title">Final Positions</h2>
        <ul>
          {units.map((unit) => (
            <li key={unit.id}>
              {unit.factionName}: {unit.territoryName}
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        onClick={() => {
          navigate("/orders");
          dispatch(startNextTurn());
        }}
      >
        Start Next Turn
      </button>
    </section>
  );
}
