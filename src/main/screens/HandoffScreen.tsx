import type { JSX } from "react";
import { requireFaction } from "../engine/lookup";
import { useAppDispatch, useRegistry, useSessionIn } from "../hooks";
import { turnLabel } from "../presentation/turn";
import { beginPlanning } from "../state/gameSlice";

/** Private handoff between people sharing the device. Shows no orders. */
export function HandoffScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const registry = useRegistry();
  const session = useSessionIn("handoff");
  const { scenario } = registry.require(session.game.scenarioId);
  const next = requireFaction(scenario, session.factionId);
  const from = session.fromFactionId === undefined ? undefined : requireFaction(scenario, session.fromFactionId);

  return (
    <main className="screen card-screen handoff-screen" aria-labelledby="handoff-title">
      <p className="screen-kicker">{turnLabel(scenario, session.game.state.turnNumber)}</p>
      <h1 id="handoff-title">{`Pass to ${next.name}`}</h1>
      <p className="screen-copy">
        {from === undefined
          ? `When the ${next.name} player has the device, begin planning.`
          : `${from.name} has submitted its orders. Pass the device to the ${next.name} player.`}
      </p>
      <div className="action-row">
        <button onClick={() => { dispatch(beginPlanning()); }} type="button">{`Continue to ${next.name}`}</button>
      </div>
    </main>
  );
}
