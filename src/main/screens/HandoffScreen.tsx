import type { JSX } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  beginPlanning,
  selectActiveFaction,
  selectActorKind,
  selectGamePhase,
  selectHandoffFromFaction,
  selectTurnDate
} from "../state/gameSlice";

export function HandoffScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const activeFaction = useAppSelector(selectActiveFaction);
  const actorKind = useAppSelector(selectActorKind);
  const fromFaction = useAppSelector(selectHandoffFromFaction);
  const phase = useAppSelector(selectGamePhase);
  const turnDate = useAppSelector(selectTurnDate);

  if (phase === "planning") return <Navigate to="/orders" replace />;
  if (phase === "resolution") return <Navigate to="/resolution" replace />;
  if (phase === "game-over") return <Navigate to="/game-over" replace />;
  if (phase !== "handoff") return <Navigate to={phase === "idle" ? "/" : "/setup"} replace />;

  if (actorKind !== "local-human") return <Navigate to="/setup" replace />;

  return (
    <main className="screen handoff-screen" aria-labelledby="handoff-title">
      <p className="screen-kicker">{turnDate}</p>
      <h1 id="handoff-title">Pass to {activeFaction.name}</h1>
      <p className="screen-copy">
        {fromFaction === undefined
          ? `When the ${activeFaction.name} commander has the device, begin planning.`
          : `${fromFaction.name} has submitted its orders. Pass the device before continuing.`}
      </p>
      <button
        type="button"
        onClick={() => {
          dispatch(beginPlanning());
          navigate("/orders");
        }}
      >
        {fromFaction === undefined ? `Begin ${activeFaction.name} Orders` : `Continue to ${activeFaction.name}`}
      </button>
    </main>
  );
}
