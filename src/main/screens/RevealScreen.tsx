import type { JSX } from "react";
import { useAppDispatch, useRegistry, useSessionIn } from "../hooks";
import { turnLabel } from "../presentation/text";
import { revealAndResolve } from "../state/gameSlice";

/** OD-5: every order is locked; reveal them together. */
export function RevealScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const registry = useRegistry();
  const session = useSessionIn("ready-to-resolve");
  const { scenario } = registry.require(session.game.scenarioId);

  return (
    <main className="screen card-screen handoff-screen" aria-labelledby="reveal-title">
      <p className="screen-kicker">{turnLabel(scenario, session.game.state.turnNumber)}</p>
      <h1 id="reveal-title">All orders are locked</h1>
      <p className="screen-copy">Every command has submitted. Reveal the orders to see how the turn resolves.</p>
      <div className="action-row">
        <button onClick={() => { dispatch(revealAndResolve()); }} type="button">Reveal and Resolve</button>
      </div>
    </main>
  );
}
