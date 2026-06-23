import type { JSX } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  selectGamePhase,
  selectResolutionSummary,
  selectSubmittedOrders,
  selectUnitsWithFactionNames,
  startNextTurn
} from "../state/gameSlice";

export function ResolutionScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const phase = useAppSelector(selectGamePhase);
  const resolutionSummary = useAppSelector(selectResolutionSummary);
  const submittedOrders = useAppSelector(selectSubmittedOrders);
  const units = useAppSelector(selectUnitsWithFactionNames);

  if (phase === "orders") {
    return <Navigate to="/orders" replace />;
  }

  if (phase !== "resolution") {
    return <Navigate to="/setup" replace />;
  }

  return (
    <section className="screen game-screen" aria-labelledby="resolution-title">
      <p className="screen-kicker">Reveal and resolve</p>
      <h1 id="resolution-title">Resolution Summary</h1>

      <section className="debug-panel" aria-labelledby="revealed-orders-title">
        <h2 id="revealed-orders-title">Revealed Orders</h2>
        <ul>
          {submittedOrders.map((order) => (
            <li key={order.factionId}>
              {order.factionName}: {order.description}
            </li>
          ))}
        </ul>
      </section>

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
