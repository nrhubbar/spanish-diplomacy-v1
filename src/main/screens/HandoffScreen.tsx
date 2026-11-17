import type { JSX } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  beginPlanning,
  runComputerTurn,
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
  if (phase !== "handoff") return <Navigate to="/setup" replace />;

  const allComputer = actorKind === "computer";

  return (
    <main className="screen handoff-screen" aria-labelledby="handoff-title">
      <p className="screen-kicker">{turnDate}</p>
      <p className="privacy-mark" aria-hidden="true">PRIVATE ORDERS</p>
      <h1 id="handoff-title">{allComputer ? "Computer commanders are ready" : `Pass to ${activeFaction.name}`}</h1>
      <p className="screen-copy">
        {allComputer
          ? "Run one complete computer turn. The game will stop at resolution so you stay in control of the pace."
          : fromFaction === undefined
            ? `When the ${activeFaction.name} player is ready, begin their private planning phase.`
            : `${fromFaction.name} has locked its orders. Hand over the device before continuing.`}
      </p>
      <button
        type="button"
        onClick={() => {
          if (allComputer) dispatch(runComputerTurn());
          else dispatch(beginPlanning());
          navigate(allComputer ? "/resolution" : "/orders");
        }}
      >
        {allComputer ? "Run Computer Turn" : fromFaction === undefined ? `Begin ${activeFaction.name} Orders` : `Continue to ${activeFaction.name}`}
      </button>
    </main>
  );
}
