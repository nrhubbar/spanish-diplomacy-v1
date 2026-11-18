import type { JSX } from "react";
import { Navigate, useNavigate } from "react-router";
import { IberiaMap } from "../components/IberiaMap";
import { useAppDispatch, useAppSelector } from "../hooks";
import { milestone2Scenario } from "../scenarios/milestone2Scenario";
import { exitGame, selectCityControl, selectControl, selectGamePhase, selectResolution, selectUnits } from "../state/gameSlice";

export function GameOverScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const cityControl = useAppSelector(selectCityControl);
  const control = useAppSelector(selectControl);
  const phase = useAppSelector(selectGamePhase);
  const resolution = useAppSelector(selectResolution);
  const units = useAppSelector(selectUnits);
  if (phase !== "game-over" || resolution?.victory === undefined) return <Navigate to={phase === "idle" ? "/" : "/setup"} replace />;
  const names = resolution.victory.factionIds.map((id) => milestone2Scenario.factions.find((faction) => faction.id === id)!.name);

  return (
    <main className="screen game-screen game-over-screen" aria-labelledby="game-over-title">
      <p className="screen-kicker">Campaign concluded</p>
      <h1 id="game-over-title">{names.join(" and ")} {names.length > 1 ? "share victory" : "wins"}</h1>
      <p className="screen-copy">Victory was secured through {resolution.victory.condition === "cities" ? "control of the decisive cities" : resolution.victory.condition === "territories" ? "territorial control" : "equal control after simultaneous resolution"}.</p>
      <IberiaMap cities={milestone2Scenario.cities} cityControl={cityControl} control={control} factions={milestone2Scenario.factions} legalDestinationIds={[]} onSelectTerritory={() => undefined} onSelectUnit={() => undefined} resolutionOutcomes={resolution.outcomes} selectedDestinationId={undefined} selectedFromTerritoryId={undefined} selectedUnitIds={[]} units={units} />
      <button type="button" onClick={() => { dispatch(exitGame()); navigate("/setup"); }}>Set Up Another Campaign</button>
    </main>
  );
}
