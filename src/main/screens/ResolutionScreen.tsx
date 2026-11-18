import type { JSX } from "react";
import { Navigate } from "react-router";
import { IberiaMap } from "../components/IberiaMap";
import { ExitGameButton } from "../components/ExitGameButton";
import { useAppDispatch, useAppSelector } from "../hooks";
import { milestone2Scenario } from "../scenarios/milestone2Scenario";
import {
  selectCityControl,
  selectControl,
  selectGamePhase,
  selectResolution,
  selectResolutionSummary,
  selectRevealedOrders,
  selectTurnDate,
  selectUnitsWithFactionNames,
  startNextTurn
} from "../state/gameSlice";

export function ResolutionScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const cityControl = useAppSelector(selectCityControl);
  const control = useAppSelector(selectControl);
  const phase = useAppSelector(selectGamePhase);
  const resolution = useAppSelector(selectResolution);
  const resolutionSummary = useAppSelector(selectResolutionSummary);
  const submittedOrders = useAppSelector(selectRevealedOrders);
  const turnDate = useAppSelector(selectTurnDate);
  const units = useAppSelector(selectUnitsWithFactionNames);

  if (phase === "game-over") return <Navigate to="/game-over" replace />;
  if (phase !== "resolution") {
    const destination = phase === "planning"
      ? "/orders"
      : phase === "handoff"
        ? "/handoff"
        : phase === "idle"
          ? "/"
          : "/setup";
    return <Navigate to={destination} replace />;
  }

  return (
    <main className="screen game-screen" aria-labelledby="resolution-title">
      <div className="screen-heading-row">
        <div>
          <p className="screen-kicker">{turnDate} · Orders revealed</p>
          <h1 id="resolution-title">Turn resolution</h1>
        </div>
        <ExitGameButton />
      </div>
      <div className="game-layout">
        <IberiaMap cities={milestone2Scenario.cities} cityControl={cityControl} control={control} factions={milestone2Scenario.factions} legalDestinationIds={[]} onSelectTerritory={() => undefined} onSelectUnit={() => undefined} resolutionOutcomes={resolution!.outcomes} selectedDestinationId={undefined} selectedFromTerritoryId={undefined} selectedUnitIds={[]} units={units} />
        <section className="order-panel resolution-panel" aria-labelledby="revealed-orders-title">
          <h2 id="revealed-orders-title">Revealed orders</h2>
          <ul className="resolution-list">{submittedOrders.map((order) => <li key={order.factionId}><strong>{order.factionName}</strong><span>{order.description}</span></li>)}</ul>
          <h2>Victory progress</h2>
          <ul className="progress-list">{resolution?.progress.map((entry) => <li key={entry.factionId}><strong>{factionName(entry.factionId)}</strong><span>{entry.territoriesControlled}/{entry.territoryThreshold} territories · {entry.citiesControlled}/{entry.cityThreshold} cities</span></li>)}</ul>
        </section>
      </div>
      <section className="outcome-panel" aria-labelledby="outcomes-title">
        <h2 id="outcomes-title">What happened</h2>
        <ul>{resolutionSummary.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul>
      </section>
      <button type="button" onClick={() => dispatch(startNextTurn())}>Start Next Turn</button>
    </main>
  );
}

function factionName(id: string): string { return milestone2Scenario.factions.find((faction) => faction.id === id)!.name; }
