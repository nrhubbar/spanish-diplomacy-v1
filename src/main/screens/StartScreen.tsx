import type { JSX } from "react";
import { useNavigate } from "react-router";

export function StartScreen(): JSX.Element {
  const navigate = useNavigate();

  return (
    <section className="screen" aria-labelledby="start-title">
      <p className="screen-kicker">Simultaneous-orders campaign</p>
      <h1 id="start-title">Spanish Diplomacy</h1>
      <p className="screen-copy">Command a historically grounded July 1936 campaign against people at this device or computer commanders.</p>
      <div className="action-row">
        <button type="button" onClick={() => navigate("/setup")}>Create Game</button>
        <button className="secondary-button" type="button" onClick={() => navigate("/settings")}>Settings</button>
      </div>
    </section>
  );
}
