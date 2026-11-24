import type { JSX } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch } from "../hooks";
import { openSetup } from "../state/gameSlice";
import { paths } from "../state/routing";

export function StartScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  return (
    <main className="screen card-screen" aria-labelledby="start-title">
      <p className="screen-kicker">Simultaneous-orders campaign</p>
      <h1 id="start-title">Spanish Diplomacy</h1>
      <p className="screen-copy">
        Plan your orders in secret, reveal them together, and see every move resolve at once. Play against people
        at this device or computer players.
      </p>
      <div className="action-row">
        <button onClick={() => { dispatch(openSetup()); }} type="button">Create Game</button>
        <button className="secondary-button" onClick={() => { void navigate(paths.settings); }} type="button">Settings</button>
        <button className="secondary-button" onClick={() => { void navigate(paths.credits); }} type="button">Credits</button>
      </div>
    </main>
  );
}
