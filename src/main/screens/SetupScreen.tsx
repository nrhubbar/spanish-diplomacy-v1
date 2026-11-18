import type { JSX } from "react";
import { useNavigate } from "react-router";
import type { ActorKind } from "../engine/types";
import { useAppDispatch, useAppSelector } from "../hooks";
import { milestone2Scenario } from "../scenarios/milestone2Scenario";
import { selectAssignments, setActorKind, startNewGame } from "../state/gameSlice";

const actorOptions: readonly { readonly label: string; readonly value: ActorKind; readonly disabled?: boolean }[] = [
  { label: "At this device", value: "local-human" },
  { label: "Computer commander", value: "computer" },
  { disabled: true, label: "Remote player — coming later", value: "online-human" }
];

export function SetupScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const assignments = useAppSelector(selectAssignments);

  return (
    <main className="screen setup-screen" aria-labelledby="setup-title">
      <p className="screen-kicker">Campaign setup · {milestone2Scenario.snapshotLabel}</p>
      <h1 id="setup-title">Choose the commanders</h1>
      <p className="screen-copy">
        Assign each operational command to someone at this device or to a computer commander.
      </p>
      <div className="faction-setup-grid">
        {milestone2Scenario.factions.map((faction) => (
          <article className="faction-card" key={faction.id} style={{ borderTopColor: faction.color }}>
            <p className="faction-abbreviation">{faction.abbreviation}</p>
            <h2>{faction.name}</h2>
            <p>{faction.motivation}</p>
            <label htmlFor={`actor-${faction.id}`}>Commander</label>
            <select
              id={`actor-${faction.id}`}
              onChange={(event) => dispatch(setActorKind({ factionId: faction.id, kind: event.target.value as ActorKind }))}
              value={assignments[faction.id]}
            >
              {actorOptions.map((option) => (
                <option disabled={option.disabled} key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </article>
        ))}
      </div>
      <div className="action-row">
        <button className="secondary-button" type="button" onClick={() => navigate("/")}>Back to home</button>
        <button type="button" onClick={() => { dispatch(startNewGame(assignments)); navigate("/handoff"); }}>
          Start Campaign
        </button>
      </div>
    </main>
  );
}
