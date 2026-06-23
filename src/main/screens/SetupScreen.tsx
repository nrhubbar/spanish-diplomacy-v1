import type { JSX } from "react";
import { useNavigate } from "react-router";
import { milestone1Scenario } from "../scenarios/milestone1Scenario";
import { useAppDispatch } from "../hooks";
import { startNewGame } from "../state/gameSlice";

export function SetupScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  return (
    <section className="screen" aria-labelledby="setup-title">
      <p className="screen-kicker">Local setup</p>
      <h1 id="setup-title">Milestone 1 Setup</h1>
      <p className="screen-copy">One human will play all three factions in a visible debug turn loop.</p>
      <ul className="setup-list">
        {milestone1Scenario.factions.map((faction) => (
          <li key={faction.id}>{faction.name}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          dispatch(startNewGame());
          navigate("/orders");
        }}
      >
        Create Local Game
      </button>
    </section>
  );
}
