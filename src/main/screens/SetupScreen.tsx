import { type JSX, useId, useState } from "react";
import type { ActorKind } from "../engine/types";
import { TimerChoice } from "../components/timer/TimerChoice";
import { givenSeed, maxSeedLength } from "../game/client";
import { useAppDispatch, useRegistry, useSessionIn } from "../hooks";
import { feedbackText } from "../presentation/feedback";
import { glyphs } from "../presentation/glyphs";
import { cssVariables } from "../components/style";
import { chooseScenario, returnHome, setActorKind, startGame } from "../state/gameSlice";

/** M2 section 3 labels (OD-4). */
const actorOptions: readonly { readonly disabled?: boolean; readonly label: string; readonly value: ActorKind }[] = [
  { label: "Local Player", value: "local-human" },
  { label: "Computer Player", value: "computer" },
  { disabled: true, label: "Online Player (coming later)", value: "online-human" }
];

export function SetupScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const registry = useRegistry();
  const session = useSessionIn("setup");
  const { scenario } = registry.require(session.scenarioId);
  const scenarios = registry.list();
  const [seed, setSeed] = useState("");
  const seedHint = useId();

  return (
    <main className="screen card-screen setup-screen" aria-labelledby="setup-title">
      <p className="screen-kicker">{`New campaign ${glyphs.dot} ${scenario.snapshotLabel}`}</p>
      <h1 id="setup-title">Choose the players</h1>
      {scenarios.length > 1 ? (
        <label className="scenario-picker">
          Scenario
          <select
            onChange={(event) => {
              const chosen = scenarios.find((summary) => summary.id === event.target.value);
              if (chosen !== undefined) dispatch(chooseScenario(chosen.id));
            }}
            value={scenario.id}
          >
            {scenarios.map((summary) => <option key={summary.id} value={summary.id}>{summary.name}</option>)}
          </select>
        </label>
      ) : null}
      <TimerChoice />
      <label className="scenario-picker">
        Game seed (optional)
        <input aria-describedby={seedHint} autoComplete="off" maxLength={maxSeedLength} onChange={(event) => { setSeed(event.target.value); }} type="text" value={seed} />
      </label>
      <p className="pane-hint" id={seedHint}>The same seed gives the same dice. Leave it empty for a secret one, shown when the game ends. Whoever chooses a seed could work out the dice.</p>
      <p className="screen-copy">Assign each command to someone at this device or to a computer player.</p>
      <div className="faction-grid">
        {scenario.factions.map((faction) => (
          <article className="faction-card" key={faction.id} style={cssVariables({ "--faction-color": faction.color })}>
            <p className="faction-abbreviation">{faction.abbreviation}</p>
            <h2>{faction.name}</h2>
            <p>{faction.motivation}</p>
            <label htmlFor={`actor-${faction.id}`}>Player</label>
            <select
              id={`actor-${faction.id}`}
              onChange={(event) => {
                const option = actorOptions.find((candidate) => candidate.value === event.target.value);
                if (option !== undefined) dispatch(setActorKind({ factionId: faction.id, kind: option.value }));
              }}
              value={session.assignments[faction.id]}
            >
              {actorOptions.map((option) => (
                <option disabled={option.disabled} key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </article>
        ))}
      </div>
      {session.feedback === undefined ? null : <p className="inline-feedback" role="alert">{feedbackText(scenario, session.feedback)}</p>}
      <div className="action-row">
        <button className="secondary-button" onClick={() => { dispatch(returnHome()); }} type="button">Back</button>
        <button onClick={() => { dispatch(startGame(givenSeed(seed))); }} type="button">Start Campaign</button>
      </div>
    </main>
  );
}
