import type { JSX } from "react";
import { useNavigate } from "react-router";

export function StartScreen(): JSX.Element {
  const navigate = useNavigate();

  return (
    <section className="screen" aria-labelledby="start-title">
      <p className="screen-kicker">Strategy prototype</p>
      <h1 id="start-title">Spanish Diplomacy</h1>
      <p className="screen-copy">Milestone 1: visible debug orders across an Iberian campaign map.</p>
      <button type="button" onClick={() => navigate("/setup")}>
        Start
      </button>
    </section>
  );
}
